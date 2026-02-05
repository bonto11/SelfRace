"""
Webhook processor:
 - mapuje athlete_id -> user_id cez strava_accounts
 - pre activity create/update spúšťa sync + coach auto-adjust
 - pre activity delete označuje activity ako deleted_at

Bezpečnostná pointa:
 - webhook je iba trigger (id + owner_id + subscription_id)
 - reálne dáta sa ťahajú zo Strava API cez tokeny v service_sync_single_activity
"""

from __future__ import annotations

import asyncio
from functools import partial
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence, Optional

from Modules.Supabase.client import get_service_client
from Services.synchronization_single import service_sync_single_activity
from Services.coach_plan_adjustment import service_coach_autoadjust_after_update
from Services.async_jobs import service_enqueue_job

supabase = get_service_client()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mark_event(
    event_id: int,
    *,
    status: str,
    error: str | None = None,
    processed_at_iso: str | None = None,
) -> None:
    supabase.table("strava_webhook_events").update(
        {
            "status": status,
            "error": error,
            "processed_at": processed_at_iso or _utc_now_iso(),
        }
    ).eq("id", event_id).execute()


async def _sync_activity(*, user_id: int, strava_activity_id: int) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        service_sync_single_activity,
        int(user_id),
        int(strava_activity_id),
        True,   # fetch_details
        None,   # user_jwt (service mode)
    )


async def _run_coach_autoadjust_service(user_id: int) -> dict:
    loop = asyncio.get_running_loop()
    fn = partial(
        service_coach_autoadjust_after_update,
        user_id=int(user_id),
        user_jwt=None,
        service=True,
    )
    return await loop.run_in_executor(None, fn)


def _enqueue_activity_review_job(*, user_id: int, user_uid: str, activity_id: int) -> None:
    """
    Enqueue AI activity review ako samostatný async job.
    Nech je to best-effort a nikdy neblokuje webhook.
    """
    try:
        service_enqueue_job(
            user_id=int(user_id),
            job_type="activity_review",
            payload={
                "activity_id": int(activity_id),
                "service": True,   # webhook = service mode
                "save_to_db": True,
            },
            user_jwt=None,
            service=True,
            # priority/dedupe_key sem zatiaľ nedávam do DB (často nemáš stĺpce)
            priority=150,
            dedupe_key=f"activity_review:{user_id}:{activity_id}",
        )
    except Exception as e:
        print(
            "[ACTIVITY-REVIEW][enqueue] failed",
            "user_id=", user_id,
            "activity_id=", activity_id,
            "err=", repr(e),
        )


async def _process_single_event(row: Mapping[str, Any]) -> None:
    event_id_raw = row.get("id")
    if not event_id_raw:
        print("[STRAVA] invalid row: missing id")
        return

    event_id = int(event_id_raw)
    now_iso = _utc_now_iso()

    object_type = row.get("object_type")
    aspect_type = row.get("aspect_type")
    owner_id = row.get("owner_id")

    # 0) object_id musí byť int
    object_id_raw = row.get("object_id")
    if object_id_raw is None:
        _mark_event(event_id, status="error", error="missing_activity_id", processed_at_iso=now_iso)
        return

    try:
        object_id = int(str(object_id_raw))
    except ValueError:
        _mark_event(event_id, status="error", error="invalid_activity_id", processed_at_iso=now_iso)
        return

    # 1) activity only
    if object_type != "activity":
        _mark_event(event_id, status="ignored", error=None, processed_at_iso=now_iso)
        return

    # 2) owner_id musí existovať
    if owner_id is None:
        _mark_event(event_id, status="error", error="missing_owner_id", processed_at_iso=now_iso)
        return

    # 3) nájsť prepojený strava_account (len aktívny)
    # ⚠️ NEselectuj user_uid ak ho nemáš v tabuľke -> padne to.
    acc_resp = (
        supabase.table("strava_accounts")
        .select("user_id, athlete_id")
        .eq("athlete_id", int(owner_id))
        .is_("deauthorized_at", None)
        .limit(1)
        .execute()
    )

    rows: Sequence[Mapping[str, Any]] = acc_resp.data or []
    account = rows[0] if rows else None
    if not account:
        _mark_event(
            event_id,
            status="orphan",
            error="no_strava_account_or_deauthorized",
            processed_at_iso=now_iso,
        )
        return

    user_id = int(account["user_id"])
    user_uid = "00000000-0000-0000-0000-000000000000"

    # 4) DELETE → označiť activity ako deleted
    if aspect_type == "delete":
        try:
            supabase.table("activities_summary").update(
                {"deleted_at": now_iso}
            ).eq("user_id", user_id).eq("activity_id", object_id).execute()
        except Exception as e:  # noqa: BLE001
            _mark_event(event_id, status="error", error=f"delete_mark_failed: {e}", processed_at_iso=now_iso)
            return

        _mark_event(event_id, status="processed", error=None, processed_at_iso=now_iso)
        return

    # 5) CREATE / UPDATE → sync + enqueue review + auto-adjust
    if aspect_type not in ("create", "update"):
        _mark_event(event_id, status="ignored", error="unknown_aspect_type", processed_at_iso=now_iso)
        return

    try:
        # 5a) sync single activity (blokujúca časť, ale beží v executor)
        await _sync_activity(user_id=user_id, strava_activity_id=object_id)

        # 5b) enqueue review job (non-blocking, best-effort)
        _enqueue_activity_review_job(user_id=user_id, user_uid=user_uid, activity_id=object_id)

        # 5c) best-effort auto-adjust
        try:
            auto_res = await _run_coach_autoadjust_service(user_id=user_id)
            print(
                "[COACH-AUTOADJUST][service]",
                "user_id=", user_id,
                "mode=", auto_res.get("mode"),
                "reason=", auto_res.get("reason"),
            )
        except Exception as e:  # noqa: BLE001
            print("[COACH-AUTOADJUST][service] error user_id=", user_id, "err=", repr(e))

    except Exception as e:  # noqa: BLE001
        _mark_event(event_id, status="error", error=str(e), processed_at_iso=now_iso)
        return

    _mark_event(event_id, status="processed", error=None, processed_at_iso=now_iso)