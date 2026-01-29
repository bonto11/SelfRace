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


# ----------------------------
# helpers
# ----------------------------

def _dbg(msg: str, payload: Optional[Dict[str, Any]] = None) -> None:
    """Primitívny debug do Railway logov."""
    if payload is None:
        print(f"[EXTRAS] {msg}", flush=True)
    else:
        try:
            print(f"[EXTRAS] {msg} | {payload}", flush=True)
        except Exception:
            print(f"[EXTRAS] {msg} | <unprintable>", flush=True)


def _to_int(v: Any, default: int) -> int:
    """Bezpečný int: zvládne aj '158.3' -> 158."""
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


# ----------------------------
# services
# ----------------------------

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
      2) ak fetch_if_missing=False -> hotovo (iba DB)
      3) ak chýbajú laps -> fetch zo Stravy + upsert laps
      4) rozhodni: použiť laps alebo generovať splits
      5) ak splits -> vygeneruj splits z laps (nie zo Stravy) + upsert splits
    """
    jwt = require_jwt(user_jwt)

    _dbg("ENTER", {"user_id": user_id, "activity_id": activity_id, "fetch_if_missing": fetch_if_missing})

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

    _dbg("DB READ", {"have_laps": bool(laps), "laps_n": len(laps or []), "have_splits": bool(splits), "splits_n": len(splits or [])})

    if not fetch_if_missing:
        _dbg("RETURN DB (fetch_if_missing=false)")
        return {
            "laps": laps or [],
            "splits": splits or [],
            "source": "db",
            "fetched": False,
        }

    # ----------------------------
    # 2) FETCH LAPS AK CHÝBAJÚ
    # ----------------------------
    fetched_from_strava = False
    if not laps:
        _dbg("LAPS missing -> FETCH STRAVA")
        client = _get_strava_client_for_user(user_id)
        laps_json = client.fetch_activity_laps(int(activity_id))
        fetched_from_strava = True

        _dbg("STRAVA laps fetched", {"count": len(laps_json or [])})

        # pre istotu nahradíme celé
        db_delete_laps_for_activity(
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )
        _dbg("DB delete laps done")

        for i, row in enumerate(laps_json or []):
            # ---- DEBUG: ukáž raw row (skrátene) ----
            if i < 3:
                _dbg("RAW lap row", {"i": i, "lap_index": row.get("lap_index"), "distance": row.get("distance"), "avg_hr": row.get("average_heartrate")})

            payload = {
                "user_id": int(user_id),
                "activity_id": int(activity_id),
                # FIX: aj keby to prišlo ako "158.3", nezabije DB smallint
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
                "avg_hr_bpm": _to_float(row.get("average_heartrate")),
                "max_hr_bpm": _to_float(row.get("max_heartrate")),
            }

            # ---- DEBUG: čo ide do DB (skrátene) ----
            if i < 3:
                _dbg("UPSERT lap payload", {
                    "i": i,
                    "lap_index": payload["lap_index"],
                    "distance_m": payload["distance_m"],
                    "avg_hr_bpm": payload["avg_hr_bpm"],
                    "avg_speed_mps": payload["avg_speed_mps"],
                })

            try:
                db_upsert_lap(payload, user_jwt=jwt, service=False)
            except Exception as e:
                # toto je presne to, čo chceš vidieť v Railway logoch
                _dbg("UPSERT lap FAILED", {"i": i, "err": str(e), "lap_index_raw": row.get("lap_index")})
                raise

        laps = db_get_activity_laps(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )
        _dbg("DB re-read laps", {"laps_n": len(laps or [])})

    # ----------------------------
    # 3) ROZHODNUTIE
    # ----------------------------
    decision = decide_use_laps_or_generate_splits(laps or [])
    _dbg("DECISION", {"decision": decision, "laps_n": len(laps or [])})

    # ----------------------------
    # 4) SPLITS – LEN AK TREBA
    # ----------------------------
    if decision == "splits":
        _dbg("SPLITS path -> delete old + generate from laps")

        db_delete_splits_for_activity(
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )
        _dbg("DB delete splits done")

        splits_rows = generate_splits_from_laps(
            user_id=user_id,
            activity_id=activity_id,
            laps=laps or [],
        )
        _dbg("Generated splits", {"count": len(splits_rows or [])})

        for i, row in enumerate(splits_rows or []):
            # ak je problém typu "158.3 do smallint", toto ti ho okamžite odhalí
            if i < 3:
                _dbg("UPSERT split row (raw)", {
                    "i": i,
                    "keys": list(row.keys()),
                    "split_index": row.get("split_index") if isinstance(row, dict) else None,
                })

            try:
                db_upsert_split(row, user_jwt=jwt, service=False)
            except Exception as e:
                _dbg("UPSERT split FAILED", {"i": i, "err": str(e), "row": row})
                raise

        splits = db_get_activity_splits(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=jwt,
            service=False,
        )
        _dbg("DB re-read splits", {"splits_n": len(splits or [])})

    else:
        _dbg("LAPS path (interval workout) -> splits empty")
        splits = []

    # source:
    # - ak sme mali už v DB a nič nefetchovalo -> db (ale tu sme fetch_if_missing=True, takže buď db alebo strava/derived)
    # - ak sme fetchli laps zo stravy -> strava (a ak potom generovali splits -> derived)
    source = "db"
    if fetched_from_strava and decision == "splits":
        source = "derived"
    elif fetched_from_strava:
        source = "strava"
    elif decision == "splits":
        # teoreticky: laps boli v DB, splits sa dopočítali
        source = "derived"

    _dbg("RETURN", {"source": source, "fetched": True, "decision": decision})

    return {
        "laps": laps or [],
        "splits": splits or [],
        "source": source,
        "fetched": True,
        "decision": decision,
    }