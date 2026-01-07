from __future__ import annotations

from typing import Dict, List, Optional

from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_activity_summary_one,
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
from Services.synchronization_bulk import enrich_activities_for_ids


def service_sync_single_activity(
    user_id: int,
    strava_activity_id: int,
    fetch_details: bool = True,
    user_jwt: Optional[str] = None,
) -> Dict[str, int]:
    """
    Sync JEDNEJ Strava aktivity – pre webhook (user_jwt=None → service client)
    aj manuálne použitie (user_jwt != None → RLS).
    """
    client = StravaActivitiesClient()

    imported = 0
    updated = 0
    skipped = 0
    fetched = 0

    aid = int(strava_activity_id)

    # sme v service-mode, ak nemáme user_jwt (napr. Strava webhook)
    service_mode = user_jwt is None

    # ---------- 1) DETAIL AKTIVITY ----------
    try:
        detail = client.fetch_activity_detail(aid)
        fetched += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] failed to fetch activity id={aid}: {e}")
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 1,
            "fetched": 0,
        }

    # ---------- 2) SUMMARY ROW ----------
    row = _normalize_summary(user_id, detail)
    if not row.get("activity_id"):
        print(f"[SYNC:single] missing activity_id for id={aid}")
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 1,
            "fetched": 0,
        }

    # ak už bola niekedy soft-deleted, sync ju má "oživiť"
    row["deleted_at"] = None

    # zisti, či už existuje (user_id + activity_id)
    try:
        existing_row = db_get_activity_summary_one(
            activity_id=aid,
            user_jwt=user_jwt,
            service=service_mode,
        )
        exists = bool(existing_row)
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] check existing failed id={aid}: {e}")
        exists = False

    try:
        db_upsert_activities_summary(
            [row],
            user_jwt=user_jwt,
            service=service_mode,
        )
        if exists:
            updated += 1
        else:
            imported += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] summary upsert failed id={aid}: {e}")
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 1,
            "fetched": fetched,
        }

    # ---------- 3) LAPS / SPLITS (voliteľné) ----------
    if fetch_details:
        try:
            laps_raw = client.fetch_activity_laps(aid)
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] laps fetch failed id={aid}: {e}")
            laps_raw = []

        splits_raw = detail.get("splits_metric") or []
        mode = _decide_laps_or_splits(laps_raw, splits_raw)

        try:
            if mode == "splits":
                db_delete_laps_for_activity(
                    aid,
                    user_jwt=user_jwt,
                    service=service_mode,
                )

                split_rows = [
                    _normalize_split(S, user_id, aid, idx)
                    for idx, S in enumerate(splits_raw, start=1)
                ]
                for row in split_rows:
                    db_upsert_split(
                        row,
                        user_jwt=user_jwt,
                        service=service_mode,
                    )

            elif mode == "laps":
                db_delete_splits_for_activity(
                    aid,
                    user_jwt=user_jwt,
                    service=service_mode,
                )

                lap_rows = [
                    _normalize_lap(L, user_id, aid)
                    for L in laps_raw
                ]
                for row in lap_rows:
                    db_upsert_lap(
                        row,
                        user_jwt=user_jwt,
                        service=service_mode,
                    )
            else:
                print(f"[SYNC:single] no usable laps/splits for id={aid}")
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] laps/splits upsert failed id={aid}: {e}")
            skipped += 1

    # ---------- 4) ENRICHMENT pre túto jednu aktivitu ----------
    try:
        enrich_activities_for_ids(
            user_id=user_id,
            activity_ids=[aid],
            user_jwt=user_jwt,
        )
    except Exception as e:
        print(f"[SYNC:single] enrichment failed id={aid}: {e}")

    print(
        f"[SYNC:single] done id={aid}: imported={imported} "
        f"updated={updated} skipped={skipped} fetched={fetched}"
    )

    return {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }