# app/strava/webhook_processor.py  (alebo pridaj na koniec webhook_routes.py)

from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.db import get_db  # adaptuj na svoj DB layer (asyncpg, SQLAlchemy, ...)

router = APIRouter(prefix="/api/strava", tags=["strava"])


# ---------- HOOK: TU DOPLŇ SVOJ EXISTUJÚCI SYNC PIPELINE ----------

async def sync_activity_from_strava(
    db: Any,
    *,
    user_id: int,
    athlete_id: int,
    strava_activity_id: int,
) -> None:
    """
    HOOK: Sem zavolaj svoje existujúce funkcie, ktoré používaš pri manuálnom SYNC tlačidle.

    Napr. niečo ako:
      - fetch_detailed_activity(...)
      - fetch_streams(...)
      - upsert_activity(...)
      - upsert_streams(...)
      - recompute_time_in_zones(...)
      - recompute_recovery_metrics(...)

    Teraz len placeholder, aby kód kompiloval.
    """
    # TODO: implementuj podľa svojho existujúceho sync flow
    raise NotImplementedError("sync_activity_from_strava() nie je ešte implementovaná")


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
    object_id = row["object_id"]

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
        # ak máš v activities napr. column deleted_at / is_deleted, doplň TU
        await db.execute(
            """
            update activities
               set deleted_at = now()
             where user_id = $1
               and strava_activity_id = $2
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

    # 4) CREATE / UPDATE → spusti sync pipeline
    try:
        await sync_activity_from_strava(
            db,
            user_id=user_id,
            athlete_id=athlete_id,
            strava_activity_id=object_id,
        )
    except NotImplementedError:
        # zatiaľ len označíme ako error, kým nedoplníš implementáciu
        await db.execute(
            """
            update strava_webhook_events
               set processed_at = now(),
                   status       = 'error',
                   last_error   = 'sync_activity_from_strava not implemented'
             where id = $1
            """,
            event_id,
        )
        # pre debug to radšej vyhodíme von
        raise
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