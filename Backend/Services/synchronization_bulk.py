from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from Services.users import require_jwt

from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_last_activity_start,
    db_get_existing_activity_ids_since,
)

from Services.synchronization_utils import (
    _normalize_summary,
    _enrich_activities_after_import,
    decide_bulk_sync_window,
)

from Services.synchronization_single import _get_access_token_for_user

MAX_FULL_DETAILS_PER_RUN = 150
HISTORICAL_MAX_ACTIVITIES = 200
HISTORICAL_PER_PAGE = 100
BACKFILL_MAX_DAYS = 50


# -----------------------------------------------------------------------------
# Core: import aktivity zo Stravy (summary + detaily)
# -----------------------------------------------------------------------------
def import_activities_bulk(
    *,
    user_id: int,
    user_jwt: Optional[str],
    mode: str = "auto",  # "auto" | "manual"
) -> Dict[str, int]:

    now = datetime.now(timezone.utc)

    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)

    days_back, max_activities = decide_bulk_sync_window(
        last_activity_dt=last_dt,
        mode=mode,
    )

    after_epoch = int((now - timedelta(days=days_back)).timestamp())
    since_iso = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")
    before_epoch = int(now.timestamp())

    print(
        f"[SYNC][BULK] user={user_id} mode={mode} "
        f"days_back={days_back} max_activities={max_activities}"
    )

    access_token = _get_access_token_for_user(user_id)
    if not access_token:
        return {"imported": 0, "updated": 0, "skipped": 0, "fetched": 0}

    client = StravaActivitiesClient(access_token=access_token)

    existing_ids = db_get_existing_activity_ids_since(
        user_id,
        since_iso,
        user_jwt=user_jwt,
    )

    imported = updated = skipped = fetched = 0
    to_upsert: List[Dict[str, Any]] = []

    page = 1
    total_fetched = 0

    while True:
        items = client.fetch_athlete_activities_page(
            after_epoch=after_epoch,
            before_epoch=before_epoch,
            page=page,
            per_page=100,
        )

        if not items:
            break

        for a in items:
            if max_activities and total_fetched >= max_activities:
                break

            total_fetched += 1
            fetched += 1

            row = _normalize_summary(user_id, a)
            aid = row.get("activity_id")

            if not aid:
                skipped += 1
                continue

            if aid in existing_ids:
                updated += 1
            else:
                imported += 1
                existing_ids.add(aid)

            row["deleted_at"] = None
            to_upsert.append(row)

        if to_upsert:
            db_upsert_activities_summary(
                to_upsert,
                user_jwt=user_jwt,
                service=False,
            )
            to_upsert.clear()

        if max_activities and total_fetched >= max_activities:
            break

        page += 1

    print(f"[SYNC][BULK] fetched={fetched} imported={imported} updated={updated}")

    # ---------- ENRICHMENT ----------
    _enrich_activities_after_import(
        user_id=user_id,
        since_iso_for_scan=since_iso,
        user_jwt=user_jwt,
    )

    return {
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "fetched": fetched,
    }


# -----------------------------------------------------------------------------
# Verejná služba – manuálny import z FE
# -----------------------------------------------------------------------------
def service_sync_activities(
    user_id: int,
    *,
    user_jwt: Optional[str],
) -> Dict[str, int]:

    jwt = require_jwt(user_jwt)

    return import_activities_bulk(
        user_id=user_id,
        user_jwt=jwt,
        mode="manual",
    )
