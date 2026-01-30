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
     decide_sync_plan,

)

from Services.synchronization_single import _get_access_token_for_user

# -----------------------------------------------------------------------------
# Core: import aktivity zo Stravy (summary + detaily)
# -----------------------------------------------------------------------------
def import_activities_bulk(
    *,
    user_id: int,
    user_jwt: Optional[str],
    trigger: str,  # "panel_init" | "manual" | "reconnect" | "quick"
) -> Dict[str, Any]:

    now = datetime.now(timezone.utc)

    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)

    now = datetime.now(timezone.utc)
    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)

    plan = decide_sync_plan(
        last_activity_dt=last_dt,
        trigger=trigger,
    )

    after_epoch = int((now - timedelta(days=plan.days_back)).timestamp())
    since_iso = (now - timedelta(days=plan.days_back)).strftime("%Y-%m-%d")

    print(
        "[SYNC][BULK]",
        {
            "user": user_id,
            "plan": plan.kind,
            "days_back": plan.days_back,
            "max_activities": plan.max_activities,
            "reason": plan.reason,
        },
    )

    
    before_epoch = int(now.timestamp())


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
            page=page,
            per_page=100,
        )

        if not items:
            break

        for a in items:
            if total_fetched >= plan.max_activities:
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

        if total_fetched >= plan.max_activities:
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
        "ok": True,
        "plan": {
            "kind": plan.kind,
            "days_back": plan.days_back,
            "max_activities": plan.max_activities,
            "reason": plan.reason,
        },
        "stats": {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "fetched": fetched,
        },
        "range": {
            "since": since_iso,
            "after_epoch": after_epoch,
        },
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
        trigger="manual",
    )