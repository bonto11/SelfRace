from __future__ import annotations

from typing import Any, Dict, Optional

from Services.synchronization_single import _get_access_token_for_user
from Modules.Strava.activities import StravaActivitiesClient

from Routes_DB.activities_summary import db_get_activity_summary_one
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


def _dbg(msg: str, payload: Optional[Dict[str, Any]] = None) -> None:
    if payload is None:
        print(f"[EXTRAS] {msg}", flush=True)
    else:
        print(f"[EXTRAS] {msg} | {payload}", flush=True)


def _to_int(v: Any, default: int = 0) -> int:
    """Bezpečný int; zvládne aj '158.3' -> 158."""
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except Exception:
        return default


def _to_float(v: Any, default: Optional[float] = None) -> Optional[float]:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


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
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

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

    return {"summary": summary, "laps": laps or [], "splits": splits or []}


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
      1) DB read
      2) ak fetch_if_missing=False -> hotovo (DB only)
      3) ak chýbajú laps -> fetch zo Stravy + upsert laps
      4) rozhodni: laps vs splits
      5) ak splits -> generuj splits z laps + upsert splits
    """
    jwt = require_jwt(user_jwt)

    _dbg(
        "ENTER",
        {
            "user_id": user_id,
            "activity_id": activity_id,
            "fetch_if_missing": fetch_if_missing,
        },
    )

    # 1) DB READ
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
    _dbg("DB READ", {"laps_n": len(laps or []), "splits_n": len(splits or [])})

    if not fetch_if_missing:
        _dbg("RETURN DB (fetch_if_missing=false)")
        return {
            "laps": laps or [],
            "splits": splits or [],
            "source": "db",
            "fetched": False,
        }
    
    if fetch_if_missing and (laps or splits):
        # ak už niečo máme, nechceme znovu prepisovať/generovať
        _dbg("CACHE HIT -> return without recompute", {"laps_n": len(laps or []), "splits_n": len(splits or [])})
        if splits:
            return {"laps": [], "splits": splits, "source": "db", "fetched": False, "decision": "splits"}
        return {"laps": laps, "splits": [], "source": "db", "fetched": False, "decision": "laps"}

    # 2) FETCH LAPS AK CHÝBAJÚ
    fetched_from_strava = False
    if not laps:
        _dbg("LAPS missing -> FETCH STRAVA")
        client = _get_strava_client_for_user(user_id)
        laps_json = client.fetch_activity_laps(int(activity_id))
        fetched_from_strava = True

        _dbg("STRAVA laps fetched", {"count": len(laps_json or [])})

        db_delete_laps_for_activity(
            activity_id=activity_id, user_jwt=jwt, service=False
        )
        _dbg("DB delete laps done")

        for i, row in enumerate(laps_json or []):
            if i < 3:
                _dbg(
                    "RAW lap row",
                    {
                        "i": i,
                        "lap_index": row.get("lap_index"),
                        "distance": row.get("distance"),
                        "avg_hr": row.get("average_heartrate"),
                        "max_hr": row.get("max_heartrate"),
                    },
                )

            payload = {
                "user_id": int(user_id),
                "activity_id": int(activity_id),
                "lap_index": _to_int(row.get("lap_index"), i + 1),
                "start_date_local": row.get("start_date_local"),
                "distance_m": _to_int(row.get("distance"), 0),
                "moving_time_s": _to_int(row.get("moving_time"), 0),
                "elapsed_time_s": _to_int(row.get("elapsed_time"), 0),
                "total_elev_gain_m": _to_float(row.get("total_elevation_gain")),
                "avg_speed_mps": _to_float(row.get("average_speed")),
                "max_speed_mps": _to_float(row.get("max_speed")),
                "avg_cadence_rpm": _to_float(row.get("average_cadence")),
                "avg_watts": _to_float(row.get("average_watts")),
                # ✅ FIX: smallint v DB
                "avg_hr_bpm": _to_int(row.get("average_heartrate"), 0),
                "max_hr_bpm": _to_int(row.get("max_heartrate"), 0),
            }

            if i < 3:
                _dbg(
                    "UPSERT lap payload",
                    {
                        "i": i,
                        "lap_index": payload["lap_index"],
                        "distance_m": payload["distance_m"],
                        "avg_hr_bpm": payload["avg_hr_bpm"],
                        "max_hr_bpm": payload["max_hr_bpm"],
                    },
                )

            try:
                db_upsert_lap(payload, user_jwt=jwt, service=False)
            except Exception as e:
                _dbg("UPSERT lap FAILED", {"i": i, "err": str(e), "payload": payload})
                raise

        laps = db_get_activity_laps(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )
        _dbg("DB re-read laps", {"laps_n": len(laps or [])})

    # 3) ROZHODNUTIE


    decision = decide_use_laps_or_generate_splits(laps or [])
    _dbg("DECISION", {"decision": decision, "laps_n": len(laps or [])})

    if decision == "splits":
        # ✅ chceme len splits -> laps musia zmiznúť (DB aj response)
        _dbg("SPLITS path -> ensure ONLY splits (delete laps + rebuild splits)")

        # zruš staré splits
        db_delete_splits_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
        _dbg("DB delete splits done")

        # vygeneruj splits z laps
        splits_rows = generate_splits_from_laps(
            user_id=user_id,
            activity_id=activity_id,
            laps=laps or [],
        )
        _dbg("Generated splits", {"count": len(splits_rows or [])})

        for row in splits_rows or []:
            db_upsert_split(row, user_jwt=jwt, service=False)

        # ✅ vymaž laps (exkluzivita)
        db_delete_laps_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
        _dbg("DB delete laps done (because decision=splits)")

        splits = db_get_activity_splits(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )

        laps = []  # ✅ response

    else:
        # ✅ chceme len laps -> splits musia zmiznúť (DB aj response)
        _dbg("LAPS path -> ensure ONLY laps (delete splits)")

        db_delete_splits_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
        _dbg("DB delete splits done (because decision=laps)")

        splits = []  # response nech je prázdne
        # laps ostávajú

        source = "db"
        if fetched_from_strava and decision == "splits":
            source = "derived"
        elif fetched_from_strava:
            source = "strava"
        elif decision == "splits":
            source = "derived"

    _dbg("RETURN", {"source": source, "fetched": True, "decision": decision})

    return {
        "laps": laps or [],
        "splits": splits or [],
        "source": source,
        "fetched": True,
        "decision": decision,
    }
