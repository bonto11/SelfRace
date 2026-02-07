from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from Modules.Supabase.auth import AuthCtx

from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_last_activity_start,
    db_get_existing_activity_ids_since,
)

from Services.synchronization_utils import (
    normalize_summary,
    enrich_activities_after_import,
     decide_sync_plan,

)

from Routes_DB.account import mark_strava_ever_synced_now, get_strava_ever_synced_at_service
from Services.synchronization_single import _get_access_token_for_user

# -----------------------------------------------------------------------------
# Core: import aktivity zo Stravy (summary + detaily)
# -----------------------------------------------------------------------------
def import_activities_bulk(
    *,
    user_id: int,
    ctx: AuthCtx,
    trigger: str,  # "panel_init" | "manual" | "reconnect" | "quick"
) -> Dict[str, Any]:

    now = datetime.now(timezone.utc)
    last_dt = db_get_last_activity_start(ctx=ctx,user_id=user_id)

    ever_synced_at = get_strava_ever_synced_at_service(ctx=ctx,user_id=user_id)
    plan = decide_sync_plan(
        ever_synced_at=ever_synced_at,
        last_activity_dt=last_dt
    )

    before_epoch = int(now.timestamp())
    after_epoch = int((now - timedelta(days=plan.days_back)).timestamp())
    since_iso = (now - timedelta(days=plan.days_back)).strftime("%Y-%m-%d")

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

    page = 1
    total_fetched = 0

    while True:
        items = client.fetch_athlete_activities_page(
            after_epoch=after_epoch,
            before_epoch=before_epoch,
            page=page,
            per_page=100,
        )

        if not items:
            break

        for a in items:
            if total_fetched >= plan.max_activities:
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

        if total_fetched >= plan.max_activities:
                break

        page += 1

    # ---------- ENRICHMENT ----------
    enrich_activities_after_import(
        user_id=user_id,
        since_iso_for_scan=since_iso,
        ctx=ctx,
    )


    mark_strava_ever_synced_now(ctx=ctx, user_id=user_id)

    return {
        "ok": True,
        "plan": {
            "kind": plan.kind,
            "days_back": plan.days_back,
            "max_activities": plan.max_activities,
            "reason": plan.reason,
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