from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from DB.users import db_list_users_for_cron
from DB.maintenance import (
    db_cleanup_deleted_activities,
    db_account_hard_delete,
    db_cleanup_expired_activity_details,
)
from DB.notifications import (
    db_get_subscriptions_with_try,
    db_delete_push_subscription,
)
from Services.supabase_auth_admin import admin_delete_auth_users

# ✅ používame generický enqueue
from Services.async_jobs import service_enqueue_job
from Modules.Supabase.auth import AuthCtx


def service_cleanup_deleted_activities(ctx: AuthCtx, cutoff_days: int = 30) -> Dict[str, Any]:
    return db_cleanup_deleted_activities(ctx=ctx,cutoff_days=cutoff_days)


def service_weekly_athlete_state_analysis(
        ctx: AuthCtx,
    max_users: int = 500, 
) -> Dict[str, Any]:
    """
    Cron:
      - zoberie userov
      - pre každého enqueuje ai_analyze job v service режime
      - worker to postupne spracuje
    """
    users: List[Dict[str, Any]] = db_list_users_for_cron(
        limit=max_users,
        ctx=ctx,
    )

    enqueued = 0

    for u in users:
        user_id = u.get("id")
        auth_uid = u.get("auth_uid")
        if not user_id or not auth_uid:
            continue

        # ✅ iba enqueue, nič viac
        resp = service_enqueue_job(
            user_id=int(user_id),
            job_type="ai_analyze",
            payload={
                # dôležité: cron = service режim, takže job musí vedieť bežať bez user_jwt
                "service": True,
                "save_to_db": True,
                "debug": False,
                "model": None,
            },
            dedupe_key=f"ai_analyze:{int(user_id)}",
            priority=60,
            ctx=ctx,
        )

        if resp.get("job"):
            enqueued += 1

    return {"users_total": len(users), "jobs_enqueued": enqueued}


def service_account_hard_delete(
    *,
    dry_run: bool = False,
    ctx: AuthCtx,
    only_user_id: Optional[int] = None,
    
) -> Dict[str, Any]:
    result = db_account_hard_delete(
        dry_run=dry_run,
        only_user_id=only_user_id,
        ctx=ctx,
    )

    if dry_run:
        return {**result, "auth_delete": {"skipped": True, "reason": "dry_run"}}

    items = result.get("items") or []
    auth_uids: List[str] = []
    for it in items:
        uid = it.get("auth_uid")
        if uid:
            auth_uids.append(str(uid))

    auth_report = admin_delete_auth_users(auth_uids)

    return {**result, "auth_delete": auth_report}


def service_cleanup_expired_activity_details(ctx: AuthCtx,) -> Dict[str, Any]:
    return db_cleanup_expired_activity_details(ctx=ctx,)


# =====================================================================
# PUSH SUBSCRIPTIONS CLEANUP
# =====================================================================

# Prah pre cleanup: ak od posledného POKUSU o odoslanie (last_try_at)
# uplynul viac ako tento počet dní bez toho, aby zariadenie cez Service
# Worker potvrdilo prijatie (last_received_at), subscription sa považuje
# za mŕtvu.
PUSH_STALE_GAP_DAYS = 3


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    """Bezpečne parsuje ISO timestamp string z DB na timezone-aware datetime."""
    if not s or not isinstance(s, str):
        return None
    try:
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def service_cleanup_stale_push_subscriptions(ctx: AuthCtx) -> Dict[str, Any]:
    """
    Volať raz denne (súčasť nočnej údržby). Porovná last_try_at (kedy sme
    naposledy SKÚSILI poslať push) s last_received_at (kedy zariadenie
    REÁLNE potvrdilo prijatie cez Service Worker — viď public/sw.js a
    endpoint /notifications/push/received). Ak je rozdiel väčší ako
    PUSH_STALE_GAP_DAYS, subscription sa považuje za mŕtvu a zmaže sa.

    last_received_at == NULL (nikdy nepotvrdilo) sa berie ako "nekonečne
    dávno" (epoch 1970) — teda akákoľvek subscription, ktorá bola skúšaná
    a nikdy nepotvrdila prijatie dlhšie než prah, sa zmaže. Čerstvo
    vytvorená subscription (prvý pokus prebehol práve teraz) tento prah
    ešte nedosiahne, takže sa omylom hneď nezmaže.
    """
    threshold = timedelta(days=PUSH_STALE_GAP_DAYS)
    subs = db_get_subscriptions_with_try(ctx=ctx)

    checked = 0
    deleted = 0
    deleted_details: List[Dict[str, Any]] = []

    for sub in subs:
        checked += 1
        last_try = _parse_iso(sub.get("last_try_at"))
        if not last_try:
            continue

        last_received = _parse_iso(sub.get("last_received_at"))
        reference = last_received or datetime(1970, 1, 1, tzinfo=timezone.utc)
        gap = last_try - reference

        if gap > threshold:
            endpoint = sub.get("endpoint")
            sub_id = sub.get("id")
            user_id = sub.get("user_id")

            if not endpoint:
                print(
                    f"[Maintenance][push_cleanup] WARN sub_id={sub_id} user_id={user_id} "
                    "has no endpoint, skipping delete"
                )
                continue

            print(
                f"[Maintenance][push_cleanup] deleting stale sub_id={sub_id} user_id={user_id} "
                f"gap={gap} (last_try_at={sub.get('last_try_at')}, "
                f"last_received_at={sub.get('last_received_at')})"
            )
            db_delete_push_subscription(endpoint=endpoint, ctx=ctx)
            deleted += 1
            deleted_details.append({"sub_id": sub_id, "user_id": user_id, "gap_seconds": gap.total_seconds()})

    print(f"[Maintenance][push_cleanup] done: checked={checked} deleted={deleted}")
    return {"success": True, "checked": checked, "deleted": deleted, "deleted_details": deleted_details}