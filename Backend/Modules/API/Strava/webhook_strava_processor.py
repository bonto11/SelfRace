# app/strava/webhook_processor.py

from datetime import datetime, timezone
from typing import Any, Mapping

import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.db import get_db  # adaptuj na svoj DB layer (asyncpg, SQLAlchemy, ...)
from Services.synchronization import service_sync_single_activity

router = APIRouter(prefix="/api/strava", tags=["strava"])


# ---------- HOOK: napojenie na tvoj existujúci sync pipeline ----------

async def sync_activity_from_strava(
    db: Any,
    *,
    user_id: int,
    athlete_id: int,
    strava_activity_id: int,
) -> None:
    """
    Wrapper okolo Services.synchronization.service_sync_single_activity
    – spustený v thread poole, aby neblokoval event loop.
    Parametre:
      - user_id         → tvoj interný user (bigint)
      - athlete_id      → Strava athlete_id (teraz nepotrebujeme, ale nechávame do budúcna)
      - strava_activity_id → raw Strava activity id (rovná sa tvojmu activity_id v summary)
    """
    loop = asyncio.get_running_loop()

    # db sa zatiaľ nepoužíva, sync ide cez tvoje existujúce DB helpery
    await loop.run_in_executor(
        None,
        service_sync_single_activity,
        int(user_id),
        int(strava_activity_id),
        True,  # fetch_details = True
    )


# ---------- LOW-LEVEL SPRACOVANIE 1 EVENTU ----------

async def _process_single_event(db: Any, row: Mapping[str, Any]) -> None:
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

    # pre istotu pretypuj na int
    try:
        object_id = int(object_id_raw)
    except Exception:
        object_id = object_id_raw

    # 1) Ak to nie je activity, zatiaľ len ignorujeme
    if object_type != "activity":
        await db.execute(
            """
            update strava_webhook_events
               set processed_at = now(),
                   status       = 'ignored'
             where id = $1
            """,
            event_id,
        )
        return

    # 2) Nájdeme strava_account → user_id
    account = await db.fetchrow(
        """
        select user_id, athlete_id
          from strava_accounts
         where athlete_id = $1
           and revoked    = false
         limit 1
        """,
        owner_id,
    )

    if not account:
        # nemáme prepojenie Strava -> user → označíme ako orphan
        await db.execute(
            """
            update strava_webhook_events
               set processed_at = now(),
                   status       = 'orphan'
             where id = $1
            """,
            event_id,
        )
        return

    user_id = account["user_id"]
    athlete_id = account["athlete_id"]

    # 3) DELETE → označ activity ako deleted (ak to riešiš)
    if aspect_type == "delete":
        # Ak máš iný názov tabuľky/column, uprav si to:
        # - activities_summary = tvoja hlavná tabuľka s aktivity summary
        # - activity_id        = Strava activity id (mapuješ tam v _normalize_summary)
        await db.execute(
            """
            update activities_summary
               set deleted_at = now()
             where user_id     = $1
               and activity_id = $2
            """,
            user_id,
            object_id,
        )

        await db.execute(
            """
            update strava_webhook_events
               set processed_at = now(),
                   status       = 'processed'
             where id = $1
            """,
            event_id,
        )
        return

    # 4) CREATE / UPDATE → spusti sync pipeline (single-activity sync)
    try:
        await sync_activity_from_strava(
            db,
            user_id=user_id,
            athlete_id=athlete_id,
            strava_activity_id=object_id,
        )
    except Exception as e:
        # nech nezdochne celý worker kvôli jednej chybe
        await db.execute(
            """
            update strava_webhook_events
               set processed_at = now(),
                   status       = 'error',
                   last_error   = $2
             where id = $1
            """,
            event_id,
            str(e),
        )
        return

    # 5) OK → označíme ako processed
    await db.execute(
        """
        update strava_webhook_events
           set processed_at = now(),
               status       = 'processed',
               last_error   = null
         where id = $1
        """,
        event_id,
    )