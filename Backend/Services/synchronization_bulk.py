from __future__ import annotations

import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_last_activity_start,
    db_get_existing_activity_ids_since,
    db_get_recent_activity_ids,
    db_update_activity_map_and_workout,  # map + workout_type
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

# spoločný helper na Strava tokeny (DB + refresh)
from Services.synchronization_single import _get_access_token_for_user


# ----------------- LIMITY / NASTAVENIA -----------------

# max backfill okno pri bulk syncu – nech netiahneme roky dozadu
MAX_BACKFILL_DAYS = 50

# koľko strán /athlete/activities stiahnuť v jednom behu (1 strana = max 100 aktivít)
MAX_PAGES_PER_RUN = 10

# pauza medzi requestami na Stravu – mierne šetrenie rate limitu
SLEEP_BETWEEN_REQUESTS_S = 0.2

# koľko aktivít max dotiahnuť s detailmi (laps/splits + mapa) v jednej synchronizácii
MAX_FULL_DETAILS_PER_RUN = 150


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
      - voliteľne detail + laps/splits pre posledné aktivity

    Vracia:
      - stats dict (imported/updated/skipped/fetched)
      - since_iso_for_scan (odkiaľ ďalej počítať zóny / enrichment)
    """

    # --------- určenie "after" (odkiaľ backfillovať) ---------

    after_epoch = 0
    since_iso_for_scan = "1970-01-01"

    # pri ďalších runoch berieme poslednú aktivitu z DB
    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)
    if last_dt:
        after_epoch = int(last_dt.timestamp())
        since_iso_for_scan = last_dt.strftime("%Y-%m-%d")
    else:
        # prvý backfill: okno max MAX_BACKFILL_DAYS
        if force_last_days is None:
            effective_days = MAX_BACKFILL_DAYS
        else:
            effective_days = min(int(force_last_days), MAX_BACKFILL_DAYS)

        after_dt = datetime.now(timezone.utc) - timedelta(days=effective_days)
        after_epoch = int(after_dt.timestamp())
        since_iso_for_scan = after_dt.strftime("%Y-%m-%d")

    existing = db_get_existing_activity_ids_since(
        user_id,
        since_iso_for_scan,
        user_jwt=user_jwt,
    )

    imported = updated = skipped = fetched = 0
    to_upsert: List[Dict[str, Any]] = []

    print(
        f"[SYNC] user={user_id} after_epoch={after_epoch} "
        f"(since={since_iso_for_scan}) window_days<= {MAX_BACKFILL_DAYS}"
    )

    # --- Strava access token z DB (žiadny legacy auth.py) ---
    access_token = _get_access_token_for_user(user_id)
    if not access_token:
        print(
            f"[SYNC] no valid Strava access_token for user_id={user_id} "
            f"(bulk import skipped)"
        )
        stats = {
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "fetched": 0,
        }
        return stats, since_iso_for_scan

    client = StravaActivitiesClient(access_token=access_token)
    service_mode = user_jwt is None  # pre DB volania (service vs RLS)

    # -------- SUMMARY import cez /athlete/activities --------
    page = 1
    while True:
        if page > MAX_PAGES_PER_RUN:
            print(
                f"[SYNC] stopping after MAX_PAGES_PER_RUN={MAX_PAGES_PER_RUN} "
                f"pages (user={user_id})"
            )
            break

        items: List[Dict[str, Any]] = client.fetch_athlete_activities_page(
            after_epoch=after_epoch,
            page=page,
            per_page=100,
        )
        if not items:
            break

        fetched += len(items)
        print(f"[SYNC] page={page} fetched={len(items)} (total={fetched})")

        for a in items:
            # základný normalized summary
            row = _normalize_summary(user_id, a)

            # doplníme workout_type + summary polyline zo Strava summary
            wt = a.get("workout_type", None)
            if wt is not None:
                try:
                    row["workout_type"] = int(wt)
                except Exception:
                    # ak príde nezmysel, radšej neprepíšeme
                    pass

            m = a.get("map") or {}
            if isinstance(m, dict):
                sp = m.get("summary_polyline")
                if sp is not None:
                    row["map_summary_polyline"] = sp

            aid = int(row["activity_id"]) if row.get("activity_id") else None
            if not aid:
                skipped += 1
                continue

            if aid in existing:
                updated += 1
            else:
                imported += 1
                existing.add(aid)

            # soft-delete undo – ak by bolo v DB deleted_at, upsert to nastaví na NULL
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

        page += 1
        time.sleep(SLEEP_BETWEEN_REQUESTS_S)

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
        # vezmeme len relatívne nedávne aktivity (od since_iso_for_scan)
        ids = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=MAX_FULL_DETAILS_PER_RUN,
            user_jwt=user_jwt,
        )

        print(
            f"[SYNC] fetching details for up to "
            f"{len(ids)}/{MAX_FULL_DETAILS_PER_RUN} activities"
        )

        for i, aid in enumerate(ids, start=1):
            try:
                laps_raw = client.fetch_activity_laps(aid)
                detail = client.fetch_activity_detail(aid)
                splits_raw = detail.get("splits_metric") or []

                # z detailu doplníme mapu + workout_type
                m = detail.get("map") or {}
                map_summary_polyline = None
                map_polyline = None

                if isinstance(m, dict):
                    map_summary_polyline = m.get("summary_polyline")
                    map_polyline = m.get("polyline")

                detail_wt = detail.get("workout_type", None)

                db_update_activity_map_and_workout(
                    activity_id=aid,
                    workout_type=detail_wt,
                    map_summary_polyline=map_summary_polyline,
                    map_polyline=map_polyline,
                    user_jwt=user_jwt,
                    service=service_mode,
                )

                mode = _decide_laps_or_splits(laps_raw, splits_raw)

                if mode == "splits":
                    db_delete_laps_for_activity(
                        aid,
                        user_jwt=user_jwt,
                        service=service_mode,
                    )
                elif mode == "laps":
                    db_delete_splits_for_activity(
                        aid,
                        user_jwt=user_jwt,
                        service=service_mode,
                    )

                if mode == "splits":
                    for idx, S in enumerate(splits_raw, start=1):
                        row = _normalize_split(S, user_id, aid, idx)
                        db_upsert_split(
                            row,
                            user_jwt=user_jwt,
                            service=service_mode,
                        )
                elif mode == "laps":
                    for L in laps_raw:
                        row = _normalize_lap(L, user_id, aid)
                        db_upsert_lap(
                            row,
                            user_jwt=user_jwt,
                            service=service_mode,
                        )
                else:
                    # nevieme rozhodnúť, necháme tak
                    print(f"[SYNC] no laps/splits decision for id={aid}")

            except Exception as e:
                skipped += 1
                print(f"[SYNC] details failed id={aid}: {e}")

            time.sleep(SLEEP_BETWEEN_REQUESTS_S)

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

    - vždy RLS režim – vyžaduje platný user_jwt
    - force_last_days je max. 50 dní (MAX_BACKFILL_DAYS), ignorujeme väčšie hodnoty
    """
    jwt = require_jwt(user_jwt)

    # cap na MAX_BACKFILL_DAYS
    if force_last_days is None:
        effective_days = MAX_BACKFILL_DAYS
    else:
        effective_days = min(int(force_last_days), MAX_BACKFILL_DAYS)

    stats, since_iso_for_scan = _import_activities_from_strava(
        user_id=user_id,
        user_jwt=jwt,
        force_last_days=effective_days,
        fetch_details=fetch_details,
    )

    _enrich_activities_after_import(
        user_id=user_id,
        since_iso_for_scan=since_iso_for_scan,
        user_jwt=jwt,
    )

    return stats