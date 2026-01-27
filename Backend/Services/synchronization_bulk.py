from __future__ import annotations

import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Sequence, Mapping

from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_last_activity_start,
    db_get_existing_activity_ids_since,
    db_get_recent_activity_ids,
)
from Routes_DB.activities_laps import (
    db_delete_laps_for_activity,
    db_upsert_lap,
)
from Routes_DB.activities_splits import (
    db_delete_splits_for_activity,
    db_upsert_split,
)

from Services.synchronization_utils import (
    _normalize_summary,
    _normalize_lap,
    _normalize_split,
    _decide_laps_or_splits,
    _enrich_activities_after_import,
)
from Services.users import require_jwt

# ⬅️ spoločný helper na Strava tokeny (DB + refresh)
from Services.synchronization_single import _get_access_token_for_user

MAX_FULL_DETAILS_PER_RUN = 150
HISTORICAL_MAX_ACTIVITIES = 200
HISTORICAL_PER_PAGE = 100
BACKFILL_MAX_DAYS = 50


def _to_list_of_dicts(items: Any) -> List[Dict[str, Any]]:
    """
    Fix pre typing/Pylance: Sequence[Mapping] -> List[Dict]
    (runtime to je jedno, ale helpery majú striktnejšie typy).
    """
    if not items:
        return []
    out: List[Dict[str, Any]] = []

    if isinstance(items, list):
        for x in items:
            if isinstance(x, dict):
                out.append(x)
            elif isinstance(x, Mapping):
                out.append(dict(x))
        return out

    if isinstance(items, Sequence):
        for x in items:
            if isinstance(x, dict):
                out.append(x)
            elif isinstance(x, Mapping):
                out.append(dict(x))

    return out


# -----------------------------------------------------------------------------
# Core: import aktivity zo Stravy (summary + detaily)
# -----------------------------------------------------------------------------
def _import_activities_from_strava(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    force_last_days: Optional[int] = 30,
    fetch_details: bool = True,
) -> tuple[Dict[str, int], str]:
    """
    Čisto import aktivity zo Stravy:
      - /athlete/activities (summary)
      - detail + laps/splits pre posledné aktivity

    Vracia:
      - stats dict (imported/updated/skipped/fetched)
      - since_iso_for_scan (odkiaľ ďalej počítať streams/zóny pre AI – max BACKFILL_MAX_DAYS dozadu)
    """
    now_utc = datetime.now(timezone.utc)

    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)
    is_first_sync = last_dt is None

    if is_first_sync:
        after_epoch = 0
        since_dt = now_utc - timedelta(days=BACKFILL_MAX_DAYS)
        since_iso_for_scan = since_dt.strftime("%Y-%m-%d")
    else:
        after_epoch = int(last_dt.timestamp())

        if force_last_days is not None:
            try:
                days = min(int(force_last_days), BACKFILL_MAX_DAYS)
            except Exception:
                days = BACKFILL_MAX_DAYS
        else:
            days = BACKFILL_MAX_DAYS

        since_dt = now_utc - timedelta(days=days)
        since_iso_for_scan = since_dt.strftime("%Y-%m-%d")

    existing = db_get_existing_activity_ids_since(
        user_id,
        since_iso_for_scan,
        user_jwt=user_jwt,
    )

    imported = updated = skipped = fetched = 0
    to_upsert: List[Dict[str, Any]] = []

    print(
        f"[SYNC] user={user_id} first_sync={is_first_sync} after_epoch={after_epoch} "
        f"(since_iso_for_scan={since_iso_for_scan})"
    )

    access_token = _get_access_token_for_user(user_id)
    if not access_token:
        print(f"[SYNC] no valid Strava access_token for user_id={user_id} (bulk import skipped)")
        stats = {"imported": 0, "updated": 0, "skipped": 0, "fetched": 0}
        return stats, since_iso_for_scan

    client = StravaActivitiesClient(access_token=access_token)
    service_mode = user_jwt is None

    # -------- SUMMARY import cez /athlete/activities --------
    page = 1
    remaining = HISTORICAL_MAX_ACTIVITIES if is_first_sync else None

    while True:
        per_page = 100
        if remaining is not None:
            if remaining <= 0:
                break
            per_page = min(per_page, HISTORICAL_PER_PAGE, remaining)

        items_any = client.fetch_athlete_activities_page(
            after_epoch=after_epoch,
            page=page,
            per_page=per_page,
        )

        # ✅ typing fix
        items: List[Dict[str, Any]] = _to_list_of_dicts(items_any)

        if not items:
            break

        fetched += len(items)
        print(
            f"[SYNC] page={page} fetched={len(items)} (total={fetched}) "
            f"(per_page={per_page}, remaining={remaining})"
        )

        for a in items:
            row = _normalize_summary(user_id, a)

            aid = int(row["activity_id"]) if row.get("activity_id") else None
            if not aid:
                skipped += 1
                continue

            if aid in existing:
                updated += 1
            else:
                imported += 1
                existing.add(aid)

            row["deleted_at"] = None
            to_upsert.append(row)

        if len(to_upsert) >= 200:
            db_upsert_activities_summary(
                to_upsert,
                user_jwt=user_jwt,
                service=service_mode,
            )
            print(f"[SYNC] upsert batch summary rows={len(to_upsert)}")
            to_upsert.clear()

        if remaining is not None:
            remaining -= len(items)
            if remaining <= 0:
                break

        page += 1
        time.sleep(0.1)

    if to_upsert:
        db_upsert_activities_summary(
            to_upsert,
            user_jwt=user_jwt,
            service=service_mode,
        )
        print(f"[SYNC] upsert remaining summary rows={len(to_upsert)}")
        to_upsert.clear()

    # -------- detaily (laps/splits + mapa/workout_type) --------
    if fetch_details and fetched:
        ids = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=MAX_FULL_DETAILS_PER_RUN,
            user_jwt=user_jwt,
        )

        for i, aid in enumerate(ids, start=1):
            try:
                laps_any = client.fetch_activity_laps(aid)
                detail = client.fetch_activity_detail(aid)
                splits_any = detail.get("splits_metric") or []

                # ✅ typing fix
                laps_raw: List[Dict[str, Any]] = _to_list_of_dicts(laps_any)
                splits_raw: List[Dict[str, Any]] = _to_list_of_dicts(splits_any)

                mode = _decide_laps_or_splits(laps_raw, splits_raw)

                if mode == "splits":
                    db_delete_laps_for_activity(aid, user_jwt=user_jwt, service=service_mode)
                elif mode == "laps":
                    db_delete_splits_for_activity(aid, user_jwt=user_jwt, service=service_mode)

                if mode == "splits":
                    for idx, S in enumerate(splits_raw, start=1):
                        row = _normalize_split(S, user_id, aid, idx)
                        db_upsert_split(row, user_jwt=user_jwt, service=service_mode)
                elif mode == "laps":
                    for L in laps_raw:
                        row = _normalize_lap(L, user_id, aid)
                        db_upsert_lap(row, user_jwt=user_jwt, service=service_mode)
                else:
                    pass

            except Exception as e:
                skipped += 1
                print(f"[SYNC] details failed id={aid}: {e}")

            time.sleep(0.1)

    stats = {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }

    print(
        f"[SYNC] import done: imported={imported} "
        f"updated={updated} skipped={skipped} fetched={fetched}"
    )

    return stats, since_iso_for_scan


# -----------------------------------------------------------------------------
# Verejná služba – manuálny import z FE
# -----------------------------------------------------------------------------
def service_sync_activities(
    user_id: int,
    force_last_days: Optional[int] = 30,
    fetch_details: bool = True,
    user_jwt: Optional[str] = None,
) -> Dict[str, int]:
    """
    Manuálny sync z FE (import zo Stravy).
    Toto je čisto RLS režim – vyžaduje platný user_jwt.
    """
    jwt = require_jwt(user_jwt)

    stats, since_iso_for_scan = _import_activities_from_strava(
        user_id=user_id,
        user_jwt=jwt,
        force_last_days=force_last_days,
        fetch_details=fetch_details,
    )

    _enrich_activities_after_import(
        user_id=user_id,
        since_iso_for_scan=since_iso_for_scan,
        user_jwt=jwt,
    )

    return stats