from __future__ import annotations

from typing import Dict, Any, List, Optional

from Routes_DB.users import db_list_users_for_cron
from Routes_DB.maintenance import (
    db_cleanup_deleted_activities,
    db_account_hard_delete,
    db_cleanup_expired_activity_details,
)
from Services.supabase_auth_admin import admin_delete_auth_users

# ✅ používame generický enqueue
from Services.async_jobs import service_enqueue_job


def service_cleanup_deleted_activities(cutoff_days: int = 30) -> Dict[str, Any]:
    return db_cleanup_deleted_activities(cutoff_days=cutoff_days)


def service_weekly_athlete_state_analysis(
    max_users: int = 500,
) -> Dict[str, Any]:
    """
    Cron:
      - zoberie userov
      - pre každého enqueuje ai_analyze job v service režime
      - worker to postupne spracuje
    """
    users: List[Dict[str, Any]] = db_list_users_for_cron(
        limit=max_users,
        user_jwt=None,
        service=True,
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
            user_uid=str(auth_uid),
            job_type="ai_analyze",
            payload={
                # dôležité: cron = service režim, takže job musí vedieť bežať bez user_jwt
                "service": True,
                "save_to_db": True,
                "debug": False,
                "model": None,
            },
            dedupe_key=f"ai_analyze:{int(user_id)}",
            priority=60,
            user_jwt=None,
            service=True,
        )

        if resp.get("job"):
            enqueued += 1

    return {"users_total": len(users), "jobs_enqueued": enqueued}


def service_account_hard_delete(
    *,
    dry_run: bool = False,
    only_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    result = db_account_hard_delete(
        dry_run=dry_run,
        only_user_id=only_user_id,
        user_jwt=None,
        service=True,
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


def service_cleanup_expired_activity_details() -> Dict[str, Any]:
    return db_cleanup_expired_activity_details()