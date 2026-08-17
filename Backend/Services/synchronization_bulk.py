from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from Modules.Supabase.auth import AuthCtx

from Modules.Strava.activities import StravaActivitiesClient

from DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_last_activity_start,
    db_get_existing_activity_ids_since,
)
from DB.async_jobs import (
    db_update_job_progress,
    db_get_last_failed_job_cursor,
)

from Services.synchronization_utils import (
    normalize_summary,
    enrich_activities_after_import,
    decide_sync_plan,
)

from DB.account import (
    mark_strava_ever_synced_now,
    get_strava_ever_synced_at_service,
    db_get_strava_admin_override,
    db_clear_strava_admin_override,
)
from Services.synchronization_single import _get_access_token_for_user
from Configs.config import STRAVA_RESUME_CURSOR_MAX_AGE_HOURS

DEBUG = True


def _dbg(*args: Any) -> None:
    if DEBUG:
        print("[SYNC_DEBUG]", *args)


def _classify_strava_fetch_error(e: Exception) -> str:
    """
    Snaží sa dať chybe čitateľný dôvod (najmä 403 - dev tier/subscription
    problém, alebo 429 - rate limit), namiesto surového repr() reťazca.
    """
    resp = getattr(e, "response", None)
    status = getattr(resp, "status_code", None) if resp is not None else None
    if status == 403:
        return "strava_403_forbidden (skontroluj dev tier / subscription na Strava API settings)"
    if status == 429:
        return "strava_429_rate_limited"
    if status is not None:
        return f"strava_http_{status}: {e}"
    return f"{type(e).__name__}: {e}"


def _epoch_from_iso(iso_str: Optional[str]) -> Optional[int]:
    """Best-effort parse zo Strava ISO timestampu (napr. start_date) na epoch."""
    if not iso_str:
        return None
    try:
        s = str(iso_str).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except Exception:
        return None


def _days_progress_pct(
    *,
    now_epoch: int,
    after_epoch: int,
    oldest_seen_epoch: Optional[int],
    cap: int = 50,
) -> int:
    """
    Progress podľa toho, koľko dní dozadu sme už pokryli - nie podľa počtu
    aktivít voči umelému stropu (max_activities je len bezpečnostný limit,
    nie skutočný počet aktivít, ktoré user má). Fetch fáza zaberá 0-50%
    z celkového progresu, zvyšných 50-99% patrí enrichment fáze
    (streams download, zóny, plan-match).
    """
    total_span = now_epoch - after_epoch
    if total_span <= 0 or oldest_seen_epoch is None:
        return 0
    covered = now_epoch - oldest_seen_epoch
    pct = int(covered / total_span * 100)
    return max(0, min(cap, pct))


def _days_covered(now_epoch: int, oldest_seen_epoch: Optional[int]) -> int:
    if oldest_seen_epoch is None:
        return 0
    return max(0, int((now_epoch - oldest_seen_epoch) / 86400))


# -----------------------------------------------------------------------------
# Core: import aktivity zo Stravy (summary + detaily)
# -----------------------------------------------------------------------------
def import_activities_bulk(
    *,
    user_id: int,
    ctx: AuthCtx,
    trigger: str,  # "panel_init" | "manual" | "reconnect" | "quick"
    job_id: Optional[int] = None,
) -> Dict[str, Any]:

    now = datetime.now(timezone.utc)
    now_epoch = int(now.timestamp())

    resumed = False
    is_admin_override = False

    # 1) Admin override má vždy prednosť - ak support práve povolil nové
    #    okno, ignorujeme akýkoľvek starý resume cursor a bežíme čerstvo.
    admin_override = db_get_strava_admin_override(user_id=user_id, ctx=ctx)
    admin_override_days = admin_override["days"] if admin_override else None
    _dbg(f"user_id={user_id} admin_override={admin_override} admin_override_days={admin_override_days}")

    resume_cursor = None
    if not admin_override_days:
        resume_cursor = db_get_last_failed_job_cursor(
            user_id=user_id,
            job_type="sync",
            max_age_hours=STRAVA_RESUME_CURSOR_MAX_AGE_HOURS,
            ctx=ctx,
        )

    if resume_cursor:
        resumed = True
        after_epoch = int(resume_cursor["after_epoch"])
        before_epoch = int(resume_cursor["before_epoch"])
        start_page = int(resume_cursor.get("next_page", 1))
        total_fetched = int(resume_cursor.get("total_fetched", 0))
        max_activities = int(resume_cursor["plan_max_activities"])
        plan_days_back = int(resume_cursor.get("plan_days_back") or 0)
        plan_kind = f"resumed:{resume_cursor.get('plan_kind', 'unknown')}"
        reason = "resumed from previous failed attempt"
        since_iso = datetime.fromtimestamp(after_epoch, tz=timezone.utc).strftime("%Y-%m-%d")
        oldest_seen_epoch: Optional[int] = int(resume_cursor.get("oldest_seen_epoch") or before_epoch)
    else:
        last_dt = db_get_last_activity_start(ctx=ctx, user_id=user_id)
        ever_synced_at = get_strava_ever_synced_at_service(ctx=ctx, user_id=user_id)
        plan = decide_sync_plan(
            ever_synced_at=ever_synced_at,
            last_activity_dt=last_dt,
            admin_override_days=admin_override_days,
        )

        is_admin_override = plan.kind == "admin_override"

        before_epoch = now_epoch
        after_epoch = int((now - timedelta(days=plan.days_back)).timestamp())
        since_iso = (now - timedelta(days=plan.days_back)).strftime("%Y-%m-%d")
        start_page = 1
        total_fetched = 0
        max_activities = plan.max_activities
        plan_days_back = plan.days_back
        plan_kind = plan.kind
        reason = plan.reason
        oldest_seen_epoch = before_epoch

    access_token = _get_access_token_for_user(user_id)
    if not access_token:
        return {"imported": 0, "updated": 0, "skipped": 0, "fetched": 0}

    client = StravaActivitiesClient(access_token=access_token)

    existing_ids = db_get_existing_activity_ids_since(
        user_id=user_id,
        since_iso_date=since_iso,
        ctx=ctx,
    )

    imported = updated = skipped = fetched = 0
    to_upsert: List[Dict[str, Any]] = []

    page = start_page

    _dbg(f"user_id={user_id} FINAL plan: kind={plan_kind} days_back={plan_days_back} max_activities={max_activities} resumed={resumed}")

    def _save_progress_cursor(next_page: int) -> None:
        if not job_id:
            return
        pct = _days_progress_pct(
            now_epoch=now_epoch,
            after_epoch=after_epoch,
            oldest_seen_epoch=oldest_seen_epoch,
        )
        days_covered = _days_covered(now_epoch, oldest_seen_epoch)
        db_update_job_progress(
            job_id=job_id,
            progress=pct,
            cursor={
                "after_epoch": after_epoch,
                "before_epoch": before_epoch,
                "next_page": next_page,
                "total_fetched": total_fetched,
                "plan_kind": plan_kind,
                "plan_days_back": plan_days_back,
                "plan_max_activities": max_activities,
                "oldest_seen_epoch": oldest_seen_epoch,
                "days_covered": days_covered,
            },
            ctx=ctx,
        )

    while True:
        try:
            items = client.fetch_athlete_activities_page(
                after_epoch=after_epoch,
                before_epoch=before_epoch,
                page=page,
                per_page=100,
            )
        except Exception as e:
            # Ulož cursor PRED re-raise, nech vieme na ďalšom pokuse
            # pokračovať presne od tejto (neúspešnej) strany.
            _save_progress_cursor(next_page=page)
            raise RuntimeError(_classify_strava_fetch_error(e)) from e

        if not items:
            break

        # Posledná položka na stránke je časovo najstaršia (Strava vracia
        # aktivity zoradené od najnovšej) - používame ju ako indikátor, ako
        # ďaleko dozadu sme sa už dostali, pre percentuálny progress podľa dní.
        last_item_epoch = _epoch_from_iso(
            items[-1].get("start_date") or items[-1].get("start_date_local")
        )
        if last_item_epoch is not None:
            oldest_seen_epoch = last_item_epoch

        for a in items:
            if total_fetched >= max_activities:
                break

            total_fetched += 1
            fetched += 1

            row = normalize_summary(user_id, a)
            aid = row.get("activity_id")

            if not aid:
                skipped += 1
                continue

            if aid in existing_ids:
                updated += 1
            else:
                imported += 1
                existing_ids.add(aid)

            row["deleted_at"] = None
            to_upsert.append(row)

        if to_upsert:
            db_upsert_activities_summary(
                rows=to_upsert,
                ctx=ctx,
            )
            to_upsert.clear()

        _save_progress_cursor(next_page=page + 1)

        if total_fetched >= max_activities:
            break

        page += 1

    

    # ---------- ENRICHMENT ----------
    # Fetch fáza je hotová (zaberala 0-50%) - nastavíme explicitný checkpoint
    # na 50%, nech enrichment fáza (streams download pre každú aktivitu)
    # vždy štartuje z rovnakého bodu, aj keby posledný cursor save z fetch
    # slučky z nejakého dôvodu nedosiahol presne 50.
    if job_id:
        db_update_job_progress(
            job_id=job_id,
            progress=50,
            cursor={
                "after_epoch": after_epoch,
                "before_epoch": before_epoch,
                "next_page": page + 1,
                "total_fetched": total_fetched,
                "plan_kind": plan_kind,
                "plan_days_back": plan_days_back,
                "plan_max_activities": max_activities,
                "oldest_seen_epoch": oldest_seen_epoch,
                "days_covered": plan_days_back,
                "phase": "enriching",
            },
            ctx=ctx,
        )

    enrich_activities_after_import(
        user_id=user_id,
        since_iso_for_scan=since_iso,
        ctx=ctx,
        job_id=job_id,
    )

    if job_id:
        db_update_job_progress(
            job_id=job_id,
            progress=99,
            cursor={
                "after_epoch": after_epoch,
                "before_epoch": before_epoch,
                "next_page": page + 1,
                "total_fetched": total_fetched,
                "plan_kind": plan_kind,
                "plan_days_back": plan_days_back,
                "plan_max_activities": max_activities,
                "oldest_seen_epoch": oldest_seen_epoch,
                "days_covered": plan_days_back,
                "phase": "finalizing",
            },
            ctx=ctx,
        )

    mark_strava_ever_synced_now(ctx=ctx, user_id=user_id)

    # Override sa spotrebuje len po úspešnom dobehnutí.
    if is_admin_override or (resumed and str(plan_kind).startswith("resumed:admin_override")):
        db_clear_strava_admin_override(user_id=user_id, ctx=ctx)

    return {
        "ok": True,
        "resumed": resumed,
        "plan": {
            "kind": plan_kind,
            "days_back": plan_days_back,
            "max_activities": max_activities,
            "reason": reason,
        },
        "stats": {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "fetched": fetched,
        },
        "range": {
            "since": since_iso,
            "after_epoch": after_epoch,
        },
    }


# -----------------------------------------------------------------------------
# Verejná služba – manuálny import z FE
# -----------------------------------------------------------------------------
def service_sync_activities(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, int]:
    return import_activities_bulk(
        user_id=user_id,
        ctx=ctx,
        trigger="manual",
    )