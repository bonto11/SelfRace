from __future__ import annotations

from typing import Any, Dict, Optional


from Services.synchronization_single import (
    _get_access_token_for_user,
)  # už to používaš inde
from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import (
    db_get_activity_summary_one,
)
from Routes_DB.activities_laps import (
    db_get_activity_laps,
    db_upsert_lap,
    db_delete_laps_for_activity,
)
from Routes_DB.activities_splits import (
    db_get_activity_splits,
    db_upsert_split,
    db_delete_splits_for_activity,
)
from Services.users import require_jwt

from Services.synchronization_utils import (
    decide_use_laps_or_generate_splits,
    generate_splits_from_laps,
)


def _get_strava_client_for_user(user_id: int) -> StravaActivitiesClient:
    token = _get_access_token_for_user(user_id)
    if not token:
        raise RuntimeError(f"Missing Strava access token for user_id={user_id}")
    return StravaActivitiesClient(access_token=token)


def service_get_activity_detail(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Detail aktivity pre FE (summary + laps + splits).

    Režimy:
      - FE / RLS: service=False + user_jwt → require_jwt
      - worker / cron / maintenance: service=True → JWT sa nevaliduje, DB vrstva použije service clienta
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    # summary ide podľa activity_id + JWT (bez user_id)
    summary = db_get_activity_summary_one(
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    return {
        "summary": summary,
        "laps": laps or [],
        "splits": splits or [],
    }


def service_get_activity_extras_cached_or_fetch(
    user_id: int,
    activity_id: int,
    *,
    fetch_if_missing: bool = False,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vracia laps + splits.

    Flow:
      1. DB read
      2. ak fetch_if_missing=False -> hotovo
      3. ak chýbajú laps -> fetch zo Stravy
      4. rozhodni: laps vs splits
      5. ak splits -> vygeneruj Z LAPS (nie zo Stravy)
    """

    jwt = require_jwt(user_jwt)

    # ----------------------------
    # 1) DB READ
    # ----------------------------
    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=False,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=False,
    )

    if not fetch_if_missing:
        return {
            "laps": laps or [],
            "splits": splits or [],
            "source": "db",
            "fetched": False,
        }

    # ----------------------------
    # 2) FETCH LAPS AK CHÝBAJÚ
    # ----------------------------
    if not laps:
        client = _get_strava_client_for_user(user_id)
        laps_json = client.fetch_activity_laps(int(activity_id))

        # pre istotu nahradíme celé
        db_delete_laps_for_activity(
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )

        for i, row in enumerate(laps_json):
            db_upsert_lap(
                {
                    "user_id": int(user_id),
                    "activity_id": int(activity_id),
                    "lap_index": int(row.get("lap_index") or (i + 1)),
                    "start_date_local": row.get("start_date_local"),
                    "distance_m": int(row.get("distance") or 0),
                    "moving_time_s": int(row.get("moving_time") or 0),
                    "elapsed_time_s": int(row.get("elapsed_time") or 0),
                    "total_elev_gain_m": row.get("total_elevation_gain"),
                    "avg_speed_mps": row.get("average_speed"),
                    "max_speed_mps": row.get("max_speed"),
                    "avg_cadence_rpm": row.get("average_cadence"),
                    "avg_watts": row.get("average_watts"),
                    "avg_hr_bpm": row.get("average_heartrate"),
                    "max_hr_bpm": row.get("max_heartrate"),
                },
                user_jwt=jwt,
                service=False,
            )

        laps = db_get_activity_laps(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )

    # ----------------------------
    # 3) ROZHODNUTIE
    # ----------------------------
    decision = decide_use_laps_or_generate_splits(laps)

    # ----------------------------
    # 4) SPLITS – LEN AK TREBA
    # ----------------------------
    if decision == "splits":
        # zruš staré (ak existujú)
        db_delete_splits_for_activity(
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )

        # vygeneruj splits z laps
        splits_rows = generate_splits_from_laps(
            user_id=user_id,
            activity_id=activity_id,
            laps=laps,
        )

        for row in splits_rows:
            db_upsert_split(
                row,
                user_jwt=jwt,
                service=False,
            )

        splits = db_get_activity_splits(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )

    else:
        # intervalový tréning → splits nedávame
        splits = []

    return {
        "laps": laps or [],
        "splits": splits or [],
        "source": "strava" if not splits else "derived",
        "fetched": True,
        "decision": decision,
    }
