# Modules/API/Strava/webhook_strava_processor.py
from datetime import datetime, timezone
from typing import Any, Mapping

import asyncio

from Modules.SQL.db_handler import get_service_client
from Services.synchronization import service_sync_single_activity

supabase = get_service_client()


async def sync_activity_from_strava(
    *,
    user_id: int,
    athlete_id: int,
    strava_activity_id: int,
) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        service_sync_single_activity,
        int(user_id),
        int(strava_activity_id),
        True,  # fetch_details = True
    )


async def _process_single_event(row: Mapping[str, Any]) -> None:
    event_id = row["id"]
    object_type = row["object_type"]
    aspect_type = row["aspect_type"]
    owner_id = row["owner_id"]
    object_id_raw = row["object_id"]

    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        object_id = int(object_id_raw)
    except Exception:
        object_id = object_id_raw

    # 1) ne-activity: ignorujeme
    if object_type != "activity":
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "ignored",
                "error": None,
            }
        ).eq("id", event_id).execute()
        return

    # 2) nájsť strava_accounts → user_id
    acc_resp = (
        supabase.table("strava_accounts")
        .select("user_id, athlete_id")
        .eq("athlete_id", owner_id)
        .is_("deauthorized_at", None)  # ⬅️ podľa tvojej schémy
        .limit(1)
        .execute()
    )
    rows = acc_resp.data or []
    account = rows[0] if rows else None

    if not account:
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "orphan",
                "error": "no_strava_account_for_athlete",
            }
        ).eq("id", event_id).execute()
        return

    user_id = account["user_id"]
    athlete_id = account["athlete_id"]

    # 3) DELETE → označiť ako deleted
    if aspect_type == "delete":
        supabase.table("activities_summary").update(
            {"deleted_at": now_iso}
        ).eq("user_id", user_id).eq("activity_id", object_id).execute()

        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "processed",
                "error": None,
            }
        ).eq("id", event_id).execute()
        return

    # 4) CREATE/UPDATE → sync
    try:
        await sync_activity_from_strava(
            user_id=user_id,
            athlete_id=athlete_id,
            strava_activity_id=object_id,
        )
    except Exception as e:
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "error",
                "error": str(e),
            }
        ).eq("id", event_id).execute()
        return

    # 5) OK
    supabase.table("strava_webhook_events").update(
        {
            "processed_at": now_iso,
            "status": "processed",
            "error": None,
        }
    ).eq("id", event_id).execute()