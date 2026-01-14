"""
Webhook processor:
 - mapuje athlete_id -> user_id cez strava_accounts
 - pre activity create/update spúšťa sync + coach auto-adjust
 - pre activity delete označuje activity ako deleted_at
"""

from __future__ import annotations

import asyncio
from functools import partial
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from Modules.Supabase.client import get_service_client
from Services.synchronization_single import service_sync_single_activity
from Services.coach_plan_adjustment import service_coach_autoadjust_after_update

supabase = get_service_client()


# ============================================================
# HELPERS
# ============================================================

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


async def _sync_activity(
    *,
    user_id: int,
    strava_activity_id: int,
) -> None:
    """
    Spustí service_sync_single_activity v SERVICE režime (bez JWT).
    """
    loop = asyncio.get_running_loop()

    await loop.run_in_executor(
        None,
        service_sync_single_activity,
        user_id,
        strava_activity_id,
        True,   # fetch_details
        None,   # user_jwt (service mode)
    )


async def _run_coach_autoadjust_service(user_id: int) -> dict:
    """
    Coach auto-adjust v SERVICE režime (best-effort).
    """
    loop = asyncio.get_running_loop()

    fn = partial(
        service_coach_autoadjust_after_update,
        user_id=user_id,
        user_jwt=None,
        service=True,  # 🔥 kritické
    )

    return await loop.run_in_executor(None, fn)


# ============================================================
# CORE
# ============================================================

async def _process_single_event(row: Mapping[str, Any]) -> None:
    """
    Spracuje JEDEN záznam zo strava_webhook_events.
    """
    event_id_raw = row.get("id")
    if not event_id_raw:
        print("[STRAVA] invalid row: missing id")
        return

    event_id = int(event_id_raw)

    object_type = row.get("object_type")
    aspect_type = row.get("aspect_type")
    owner_id = row.get("owner_id")
    object_id_raw = row.get("object_id")

    now_iso = _utc_now_iso()

    # --------------------------------------------------------
    # 0) object_id MUSÍ byť int (Strava activity id)
    # --------------------------------------------------------
    object_id_raw = row.get("object_id")

    if object_id_raw is None:
        _mark_event(
            event_id,
            status="error",
            error="missing_activity_id",
            processed_at_iso=now_iso,
        )
        return

    try:
        object_id = int(str(object_id_raw))  # <-- str() zúži Any -> str
    except ValueError:
        _mark_event(
            event_id,
            status="error",
            error="invalid_activity_id",
            processed_at_iso=now_iso,
        )
        return

    # --------------------------------------------------------
    # 1) activity only
    # --------------------------------------------------------
    if object_type != "activity":
        _mark_event(
            event_id,
            status="ignored",
            error=None,
            processed_at_iso=now_iso,
        )
        return

    # --------------------------------------------------------
    # 2) owner_id musí existovať
    # --------------------------------------------------------
    if owner_id is None:
        _mark_event(
            event_id,
            status="error",
            error="missing_owner_id",
            processed_at_iso=now_iso,
        )
        return

    # --------------------------------------------------------
    # 3) nájsť prepojený strava_account (len aktívny)
    # --------------------------------------------------------
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

    # --------------------------------------------------------
    # 4) DELETE → označiť activity ako deleted
    # --------------------------------------------------------
    if aspect_type == "delete":
        try:
            supabase.table("activities_summary").update(
                {"deleted_at": now_iso}
            ).eq("user_id", user_id).eq(
                "activity_id", object_id
            ).execute()
        except Exception as e:  # noqa: BLE001
            _mark_event(
                event_id,
                status="error",
                error=f"delete_mark_failed: {e}",
                processed_at_iso=now_iso,
            )
            return

        _mark_event(
            event_id,
            status="processed",
            error=None,
            processed_at_iso=now_iso,
        )
        return

    # --------------------------------------------------------
    # 5) CREATE / UPDATE → sync + auto-adjust
    # --------------------------------------------------------
    try:
        await _sync_activity(
            user_id=user_id,
            strava_activity_id=object_id,
        )

        # auto-adjust je best-effort
        try:
            auto_res = await _run_coach_autoadjust_service(user_id=user_id)
            print(
                "[COACH-AUTOADJUST][service]",
                "user_id=", user_id,
                "mode=", auto_res.get("mode"),
                "reason=", auto_res.get("reason"),
                "be_flags=", auto_res.get("be_flags"),
                "recovery_debug=", auto_res.get("recovery_debug"),
            )
        except Exception as e:  # noqa: BLE001
            print(
                "[COACH-AUTOADJUST][service] error for user",
                user_id,
                ":",
                repr(e),
            )

    except Exception as e:  # noqa: BLE001
        _mark_event(
            event_id,
            status="error",
            error=str(e),
            processed_at_iso=now_iso,
        )
        return

    # --------------------------------------------------------
    # 6) OK
    # --------------------------------------------------------
    _mark_event(
        event_id,
        status="processed",
        error=None,
        processed_at_iso=now_iso,
    )