from __future__ import annotations

import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from Modules.Strava.activities import StravaActivitiesClient
from Services.activities_streams import fetch_and_optionally_store_batch
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)
from Services.async_jobs import service_enqueue_job, service_run_job_now

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
)
from Services.users import require_jwt


# Koľko detailov (laps/splits) max dotiahnuť v jednej synchronizácii
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
      - laps/splits pre posledné aktivity

    Vracia:
      - stats dict (imported/updated/skipped/fetched)
      - since_iso_for_scan (odkiaľ ďalej počítať streams/zóny)
    """
    client = StravaActivitiesClient()

    after_epoch = 0
    since_iso_for_scan = "1970-01-01"

    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)
    if last_dt:
        after_epoch = int(last_dt.timestamp())
        since_iso_for_scan = last_dt.strftime("%Y-%m-%d")
    elif force_last_days is not None:
        after_dt = datetime.now(timezone.utc) - timedelta(days=force_last_days)
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
        f"(since={since_iso_for_scan})"
    )

    page = 1
    while True:
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

            to_upsert.append(row)

        if len(to_upsert) >= 200:
            db_upsert_activities_summary(
                to_upsert,
                user_jwt=user_jwt,
            )
            print(f"[SYNC] upsert batch summary rows={len(to_upsert)}")
            to_upsert.clear()

        page += 1
        time.sleep(0.1)

    if to_upsert:
        db_upsert_activities_summary(
            to_upsert,
            user_jwt=user_jwt,
        )
        print(f"[SYNC] upsert remaining summary rows={len(to_upsert)}")
        to_upsert.clear()

    # -------- detaily (laps/splits) --------
    if fetch_details and fetched:
        ids = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=MAX_FULL_DETAILS_PER_RUN,
            user_jwt=user_jwt,
        )

        for i, aid in enumerate(ids, start=1):
            try:
                laps_raw = client.fetch_activity_laps(aid)
                detail = client.fetch_activity_detail(aid)
                splits_raw = detail.get("splits_metric") or []

                mode = _decide_laps_or_splits(laps_raw, splits_raw)

                if mode == "splits":
                    db_delete_laps_for_activity(aid, user_jwt=user_jwt)
                elif mode == "laps":
                    db_delete_splits_for_activity(aid, user_jwt=user_jwt)

                if mode == "splits":
                    for idx, S in enumerate(splits_raw, start=1):
                        row = _normalize_split(S, user_id, aid, idx)
                        db_upsert_split(row, user_jwt=user_jwt)
                elif mode == "laps":
                    for L in laps_raw:
                        row = _normalize_lap(L, user_id, aid)
                        db_upsert_lap(row, user_jwt=user_jwt)
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
# Spoločná enrichment logika (streams + zóny + plan_match)
# -----------------------------------------------------------------------------
def enrich_activities_for_ids(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
) -> None:
    if not activity_ids:
        print("[SYNC] enrich: no activity ids, skipping")
        return

    try:
        print(f"[SYNC] streams: fetching & storing for {len(activity_ids)} ids …")
        streams_res = fetch_and_optionally_store_batch(
            user_id,
            activity_ids,
            store=True,
            user_jwt=user_jwt,
        )
        print(
            f"[SYNC] streams: stored={streams_res.get('stored')} / "
            f"total={streams_res.get('count')}"
        )

        print("[SYNC] zones: computing minutes from cached streams …")
        prev = preview_zones_for_activities(
            user_id,
            activity_ids,
            fetch_if_missing=False,
            user_jwt=user_jwt,
        )

        to_save = [
            it for it in (prev.get("items") or []) if it.get("ok") and it.get("minutes")
        ]
        saved = upsert_enrichment_minutes(user_id, to_save, user_jwt=user_jwt)
        print(f"[SYNC] zones: enrichment upsert saved rows = {saved.get('saved', 0)}")

        try:
            enqueue = service_enqueue_job(
                user_id=user_id,
                user_uid="",
                job_type="plan_match",
                payload={
                    "activity_ids": activity_ids,
                    "days_window": 1,
                    "score_threshold": 0.55,
                },
                priority=90,
                max_attempts=1,
                dedupe_key=None,
                user_jwt=user_jwt,
            )

            job = (enqueue or {}).get("job")
            if not job:
                print("[SYNC] plan auto-mapping: enqueue_failed")
            else:
                run = service_run_job_now(
                    user_id=user_id,
                    job_id=int(job["id"]),
                    worker_id="sync_auto_map",
                    user_jwt=user_jwt,
                )

                job_row = run.get("job") or {}
                result = job_row.get("result") or {}

                print(
                    "[SYNC] plan auto-mapping (job): "
                    f"candidates={result.get('candidates')} "
                    f"mapped={result.get('mapped')} "
                    f"skipped={result.get('skipped')} "
                    f"processed={result.get('processed')} "
                    f"error={run.get('error')}"
                )

        except Exception as e:
            print(f"[SYNC] plan auto-mapping via job failed: {e}")

    except Exception as e:
        print(f"[SYNC] zones enrichment failed: {e}")


def _enrich_activities_after_import(
    user_id: int,
    since_iso_for_scan: str,
    *,
    user_jwt: Optional[str] = None,
) -> None:
    """
    Wrapper: vyberie recent IDs od since_iso_for_scan a pustí enrichment.
    """
    try:
        ids_recent = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=500,
            user_jwt=user_jwt,
        )

        if not ids_recent:
            print("[SYNC] enrich: no recent activity ids, skipping")
            return

        enrich_activities_for_ids(
            user_id=user_id,
            activity_ids=ids_recent,
            user_jwt=user_jwt,
        )
    except Exception as e:
        print(f"[SYNC] enrich wrapper failed: {e}")


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
