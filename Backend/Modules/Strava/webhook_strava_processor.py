"""
Webhook processor (thin):
 - mapuje athlete_id -> user_id cez strava_accounts
 - pre activity create/update iba ENQUEUE strava_sync_activity
 - pre activity delete iba ENQUEUE mark_activity_deleted
 - nič nesťahuje zo Stravy, nič nepočítá, nič neadjustuje

Bezpečnostná pointa:
 - webhook je iba trigger (id + owner_id + subscription_id)
 - reálne dáta sa ťahajú zo Strava API cez tokeny v async worker jobe
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from Modules.Supabase.client import get_service_client
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


def _enqueue_strava_sync(*, user_id: int, activity_id: int) -> None:
    # Dedupe: viac webhookov na tú istú aktivitu (create+update spam) nech sa zlepí do 1 jobu
    service_enqueue_job(
        user_id=int(user_id),
        job_type="strava_sync_activity",
        payload={
            "activity_id": int(activity_id),
            "fetch_details": True,
            # service mode (webhook)
            "service": True,
        },
        user_jwt=None,
        service=True,
        priority=80,
        dedupe_key=f"strava_sync_activity:{user_id}:{activity_id}",
    )


def _enqueue_mark_deleted(*, user_id: int, activity_id: int, deleted_at_iso: str) -> None:
    service_enqueue_job(
        user_id=int(user_id),
        job_type="mark_activity_deleted",
        payload={
            "activity_id": int(activity_id),
            "deleted_at": str(deleted_at_iso),
            "service": True,
        },
        user_jwt=None,
        service=True,
        priority=60,
        dedupe_key=f"mark_activity_deleted:{user_id}:{activity_id}",
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

    # 4) DELETE → len enqueue mark_deleted
    if aspect_type == "delete":
        try:
            _enqueue_mark_deleted(user_id=user_id, activity_id=object_id, deleted_at_iso=now_iso)
        except Exception as e:  # noqa: BLE001
            _mark_event(event_id, status="error", error=f"enqueue_delete_failed: {e}", processed_at_iso=now_iso)
            return

        _mark_event(event_id, status="processed", error=None, processed_at_iso=now_iso)
        return

    # 5) CREATE / UPDATE → len enqueue sync job
    if aspect_type not in ("create", "update"):
        _mark_event(event_id, status="ignored", error="unknown_aspect_type", processed_at_iso=now_iso)
        return

    try:
        _enqueue_strava_sync(user_id=user_id, activity_id=object_id)
    except Exception as e:  # noqa: BLE001
        _mark_event(event_id, status="error", error=f"enqueue_sync_failed: {e}", processed_at_iso=now_iso)
        return

    _mark_event(event_id, status="processed", error=None, processed_at_iso=now_iso)