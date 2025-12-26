# Modules/API/Strava/webhook_strava_processor.py
from datetime import datetime, timezone
from typing import Any, Mapping

import asyncio

from Modules.SQL.db_handler import get_service_client
from Services.synchronization import service_sync_single_activity

# Supabase client – service role (admin prístup)
supabase = get_service_client()


# ---------- HOOK: napojenie na tvoj existujúci sync pipeline ----------

async def sync_activity_from_strava(
    *,
    user_id: int,
    athlete_id: int,
    strava_activity_id: int,
) -> None:
    """
    Wrapper okolo Services.synchronization.service_sync_single_activity
    – spustený v thread poole, aby neblokoval event loop.
    """
    loop = asyncio.get_running_loop()

    await loop.run_in_executor(
        None,
        service_sync_single_activity,
        int(user_id),
        int(strava_activity_id),
        True,  # fetch_details = True
    )


# ---------- LOW-LEVEL SPRACOVANIE 1 EVENTU ----------

async def _process_single_event(row: Mapping[str, Any]) -> None:
    """
    Spracuje JEDEN záznam zo strava_webhook_events.
    - rozlišuje object_type (activity/athlete)
    - rozlišuje aspect_type (create/update/delete)
    - pri activity create/update zavolá sync pipeline
    """
    event_id = row["id"]
    object_type = row["object_type"]
    aspect_type = row["aspect_type"]
    owner_id = row["owner_id"]
    object_id_raw = row["object_id"]

    now_iso = datetime.now(timezone.utc).isoformat()

    # pre istotu pretypuj na int
    try:
        object_id = int(object_id_raw)
    except Exception:
        object_id = object_id_raw

    # 1) Ak to nie je activity, zatiaľ len ignorujeme
    if object_type != "activity":
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "ignored",
            }
        ).eq("id", event_id).execute()
        return

    # 2) Nájdeme strava_account → user_id
    acc_resp = (
        supabase.table("strava_accounts")
        .select("user_id, athlete_id")
        .eq("athlete_id", owner_id)
        .eq("revoked", False)
        .limit(1)
        .execute()
    )

    rows = acc_resp.data or []
    account = rows[0] if rows else None

    if not account:
        # nemáme prepojenie Strava -> user → označíme ako orphan
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "orphan",
            }
        ).eq("id", event_id).execute()
        return

    user_id = account["user_id"]
    athlete_id = account["athlete_id"]

    # 3) DELETE → označ activity ako deleted (ak to riešiš)
    if aspect_type == "delete":
        supabase.table("activities_summary").update(
            {
                "deleted_at": now_iso,
            }
        ).eq("user_id", user_id).eq("activity_id", object_id).execute()

        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "processed",
                "last_error": None,
            }
        ).eq("id", event_id).execute()
        return

    # 4) CREATE / UPDATE → spusti sync pipeline (single-activity sync)
    try:
        await sync_activity_from_strava(
            user_id=user_id,
            athlete_id=athlete_id,
            strava_activity_id=object_id,
        )
    except Exception as e:
        # nech nezdochne worker kvôli jednej chybe
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "error",
                "last_error": str(e),
            }
        ).eq("id", event_id).execute()
        return

    # 5) OK → označíme ako processed
    supabase.table("strava_webhook_events").update(
        {
            "processed_at": now_iso,
            "status": "processed",
            "last_error": None,
        }
    ).eq("id", event_id).execute()