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


# -------------------------------------------------------------------
# Debug helper (primitívny print do Railway logov)
# -------------------------------------------------------------------
def _dbg(msg: str, payload: Optional[Dict[str, Any]] = None) -> None:
    if payload is None:
        print(f"[EXTRAS] {msg}", flush=True)
    else:
        print(f"[EXTRAS] {msg} | {payload}", flush=True)


# -------------------------------------------------------------------
# Safe converters (Strava občas vracia floaty aj tam kde chceš int)
# -------------------------------------------------------------------
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


# -------------------------------------------------------------------
# Strava client pre usera
# -------------------------------------------------------------------
def _get_strava_client_for_user(user_id: int) -> StravaActivitiesClient:
    token = _get_access_token_for_user(user_id)
    if not token:
        raise RuntimeError(f"Missing Strava access token for user_id={user_id}")
    return StravaActivitiesClient(access_token=token)


# -------------------------------------------------------------------
# FE detail aktivity (summary + laps + splits) - len DB read
# -------------------------------------------------------------------
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
    jwt = user_jwt if service else require_jwt(user_jwt)

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


# -------------------------------------------------------------------
# Extras cache/fetch: v DB má byť vždy LEN laps alebo LEN splits
# -------------------------------------------------------------------
def service_get_activity_extras_cached_or_fetch(
    user_id: int,
    activity_id: int,
    *,
    fetch_if_missing: bool = False,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vracia laps + splits, ale drží pravidlo:
      ✅ v DB aj v response je vždy LEN 1 z (laps | splits)

    Flow:
      1) DB read
      2) ak fetch_if_missing=False -> vráť DB (bez zásahu)
      3) ak cache hit (už máme laps alebo splits) -> vráť bez prepočtu
      4) ak chýba -> fetch laps zo Stravy -> ulož laps
      5) decision:
          - "splits": vygeneruj splits z laps, ulož splits, vymaž laps
          - "laps": vymaž splits (ak existujú), nechaj laps
    """
    jwt = require_jwt(user_jwt)

    _dbg(
        "ENTER",
        {"user_id": user_id, "activity_id": activity_id, "fetch_if_missing": fetch_if_missing},
    )

    # 1) DB READ
    laps = db_get_activity_laps(user_id=user_id, activity_id=activity_id, user_jwt=jwt, service=False) or []
    splits = db_get_activity_splits(user_id=user_id, activity_id=activity_id, user_jwt=jwt, service=False) or []
    _dbg("DB READ", {"laps_n": len(laps), "splits_n": len(splits)})

    # source musí existovať vždy
    source: str = "db"
    decision: str = "unknown"
    fetched_from_strava = False

    # 2) DB-only režim
    if not fetch_if_missing:
        # aj tu je fajn držať shape: ak náhodou existujú oba, nič nerobíme (len vraciame)
        _dbg("RETURN DB (fetch_if_missing=false)")
        return {"laps": laps, "splits": splits, "source": "db", "fetched": False}

    # 3) CACHE HIT -> nič negenerovať / nemazať
    if laps or splits:
        _dbg("CACHE HIT -> return without recompute", {"laps_n": len(laps), "splits_n": len(splits)})
        if splits:
            return {"laps": [], "splits": splits, "source": "db", "fetched": False, "decision": "splits"}
        return {"laps": laps, "splits": [], "source": "db", "fetched": False, "decision": "laps"}

    # 4) FETCH LAPS zo Stravy (lebo nemáme nič)
    _dbg("CACHE MISS -> FETCH STRAVA LAPS")
    client = _get_strava_client_for_user(user_id)
    laps_json = client.fetch_activity_laps(int(activity_id))
    fetched_from_strava = True
    _dbg("STRAVA laps fetched", {"count": len(laps_json or [])})

    # pre istotu čistý replace laps
    db_delete_laps_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
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
            # DB: smallint
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

        db_upsert_lap(payload, user_jwt=jwt, service=False)

    laps = db_get_activity_laps(user_id=user_id, activity_id=activity_id, user_jwt=jwt, service=False) or []
    _dbg("DB re-read laps", {"laps_n": len(laps)})

    # 5) DECISION
    decision = decide_use_laps_or_generate_splits(laps)
    _dbg("DECISION", {"decision": decision, "laps_n": len(laps)})

    # 6) EXCLUSIVE WRITE
    if decision == "splits":
        # chceme LEN splits
        source = "derived" if fetched_from_strava else "db"

        _dbg("SPLITS path -> ensure ONLY splits")

        # vymaž staré splits a vygeneruj nové
        db_delete_splits_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
        _dbg("DB delete splits done")

        splits_rows = generate_splits_from_laps(user_id=user_id, activity_id=activity_id, laps=laps)
        _dbg("Generated splits", {"count": len(splits_rows or [])})

        for i, row in enumerate(splits_rows or []):
            if i < 3:
                _dbg("UPSERT split row (raw)", {"i": i, "keys": list(row.keys()) if isinstance(row, dict) else None})
            db_upsert_split(row, user_jwt=jwt, service=False)

        splits = db_get_activity_splits(user_id=user_id, activity_id=activity_id, user_jwt=jwt, service=False) or []
        _dbg("DB re-read splits", {"splits_n": len(splits)})

        # ✅ vymaž laps, aby v DB ostalo len splits
        db_delete_laps_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
        _dbg("DB delete laps done (because decision=splits)")

        laps = []  # response

    else:
        # chceme LEN laps
        source = "strava" if fetched_from_strava else "db"

        _dbg("LAPS path -> ensure ONLY laps")

        # ✅ vymaž splits, aby v DB ostalo len laps
        db_delete_splits_for_activity(activity_id=activity_id, user_jwt=jwt, service=False)
        _dbg("DB delete splits done (because decision=laps)")

        splits = []  # response

    _dbg("RETURN", {"source": source, "fetched": True, "decision": decision, "laps_n": len(laps), "splits_n": len(splits)})

    return {
        "laps": laps,
        "splits": splits,
        "source": source,
        "fetched": True,
        "decision": decision,
    }