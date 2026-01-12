from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

import asyncio
from functools import partial

from Modules.Supabase.client import get_service_client
from Services.synchronization_single import service_sync_single_activity
from Services.coach_plan_adjustment import (
    service_coach_autoadjust_after_update,
)

supabase = get_service_client()


async def sync_activity_from_strava(
    *,
    user_id: int,
    athlete_id: int,
    strava_activity_id: int,
) -> None:
    """
    Spustí service_sync_single_activity v thread executore.
    Beží v "service" režime (user_jwt=None, t.j. service role).
    """
    loop = asyncio.get_running_loop()

    await loop.run_in_executor(
        None,
        service_sync_single_activity,
        int(user_id),
        int(strava_activity_id),
        True,  # fetch_details
        None,  # user_jwt (service mode)
    )


async def _run_coach_autoadjust_service(user_id: int) -> dict:
    """
    Spustí coach auto-adjust v SERVICE režime (bez JWT) v thread executore.

    - recent_load + recovery (BE),
    - ak BE flagy sú červené → AI analyze + weekly/daily replan cez service klienta.
    """
    loop = asyncio.get_running_loop()

    fn = partial(
        service_coach_autoadjust_after_update,
        user_id=user_id,
        user_jwt=None,
        service=True,  # ⬅️ kritické – celé ide cez service režim
    )

    return await loop.run_in_executor(None, fn)


async def _process_single_event(row: Mapping[str, Any]) -> None:
    """
    Spracuje JEDEN záznam zo strava_webhook_events.
    """
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

    # 1) activity only, ostatné ignorujeme
    if object_type != "activity":
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "ignored",
                "error": None,
            }
        ).eq("id", event_id).execute()
        return

    # 2) nájsť strava_account → user_id
    acc_resp = (
        supabase.table("strava_accounts")
        .select("user_id, athlete_id")
        .eq("athlete_id", owner_id)
        .is_("deauthorized_at", None)
        .limit(1)
        .execute()
    )

    rows: Sequence[Mapping[str, Any]] = acc_resp.data or []
    account = rows[0] if rows else None

    if not account:
        supabase.table("strava_webhook_events").update(
            {
                "processed_at": now_iso,
                "status": "orphan",
                "error": "no_strava_account",
            }
        ).eq("id", event_id).execute()
        return

    user_id = account["user_id"]
    athlete_id = account["athlete_id"]

    # 3) DELETE → označiť activity ako deleted (ak existuje)
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

    # 4) CREATE/UPDATE → sync + auto-adjust
    try:
        await sync_activity_from_strava(
            user_id=user_id,
            athlete_id=athlete_id,
            strava_activity_id=object_id,
        )

        try:
            auto_res = await _run_coach_autoadjust_service(user_id=user_id)
            print(
                "[COACH-AUTOADJUST][service]",
                "user_id=",
                user_id,
                "mode=",
                auto_res.get("mode"),
                "reason=",
                auto_res.get("reason"),
                "be_flags=",
                auto_res.get("be_flags"),
                "recovery_debug=",
                auto_res.get("recovery_debug"),
            )
        except Exception as e:
            print(
                "[COACH-AUTOADJUST][service] error for user",
                user_id,
                ":",
                repr(e),
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