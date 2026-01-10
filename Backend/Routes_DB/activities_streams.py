from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_STREAMS

DEBUG_STREAMS_DB = True


def _dbg_db(*args: Any, **kwargs: Any) -> None:
    if DEBUG_STREAMS_DB:
        print("[streams-db]", *args, **kwargs, flush=True)


def db_get_streams_one(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Jedna row so streamami pre danú aktivitu.

    Teraz vraciame všetky dôležité polia:
      - time_s
      - heartrate_bpm
      - cadence_rpm
      - power_w
      - distance_m
      - altitude_m
      - speed_mps
      - grade_smooth
      - temp_c
      - moving
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")

    _dbg_db(
        "db_get_streams_one query:",
        {"user_id": user_id, "activity_id": activity_id},
    )

    res = (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .select(
            "time_s,"
            "heartrate_bpm,"
            "cadence_rpm,"
            "power_w,"
            "distance_m,"
            "altitude_m,"
            "speed_mps,"
            "grade_smooth,"
            "temp_c,"
            "moving"
        )
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .limit(1)
        .execute()
    )
    data = res.data or []
    if not data:
        _dbg_db("db_get_streams_one result: EMPTY")
        return None

    row = data[0]
    _dbg_db(
        "db_get_streams_one result keys:",
        sorted(list(row.keys())),
    )
    _dbg_db(
        "db_get_streams_one result sizes:",
        {
            "time_s": len(row.get("time_s") or []),
            "heartrate_bpm": len(row.get("heartrate_bpm") or []),
            "cadence_rpm": len(row.get("cadence_rpm") or []),
            "power_w": len(row.get("power_w") or []),
            "distance_m": len(row.get("distance_m") or []),
            "altitude_m": len(row.get("altitude_m") or []),
            "speed_mps": len(row.get("speed_mps") or []),
            "grade_smooth": len(row.get("grade_smooth") or []),
            "temp_c": len(row.get("temp_c") or []),
        },
    )
    return row


def db_get_streams_ids_present(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[int]:
    """
    Vráti zoznam activity_id, pre ktoré už existuje aspoň jeden stream záznam.

    - typicky sync/worker: service=True
    - prípadne RLS:        user_jwt=jwt
    """
    if not activity_ids:
        return []

    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")

    _dbg_db(
        "db_get_streams_ids_present query:",
        {"user_id": user_id, "activity_ids": activity_ids},
    )

    res = (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .select("activity_id")
        .eq("user_id", user_id)
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    rows = res.data or []
    out: List[int] = []
    for r in rows:
        try:
            out.append(int(r["activity_id"]))
        except Exception:
            pass

    _dbg_db(
        "db_get_streams_ids_present result:",
        {"present_ids": out},
    )
    return out


def db_upsert_streams_with_sport(
    user_id: int,
    activity_id: int,
    *,
    time_s: List[int],
    heartrate: List[int],
    cadence: List[int],
    power: List[int],
    distance: List[float],
    altitude: List[float],
    speed: List[float],
    grade: List[float],
    temp: List[float],
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Volá SQL funkciu upsert_streams_with_sport(...) cez RPC.

    POZOR: táto funkcia RPC stále používa pôvodné parametre.
    Nové polia (altitude, speed, atď.) riešime cez db_upsert_stream_arrays.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")

    params = {
        "p_user_id": int(user_id),
        "p_activity_id": int(activity_id),
        "p_time_s": [int(x) for x in time_s],
        "p_heartrate": [int(x) for x in heartrate] if heartrate else [],
        "p_cadence": [int(x) for x in cadence] if cadence else [],
        "p_power": [int(x) for x in power] if power else [],
        "p_distance": [float(x) for x in distance] if distance else [],
        "p_altitude": [float(x) for x in altitude] if altitude else [],
        "p_speed": [float(x) for x in speed] if speed else [],
        "p_grade": [float(x) for x in grade] if grade else [],
        "p_temp": [float(x) for x in temp] if temp else [],
    }

    _dbg_db(
        "db_upsert_streams_with_sport params sizes:",
        {
            "time_s": len(params["p_time_s"]),
            "heartrate": len(params["p_heartrate"]),
            "cadence": len(params["p_cadence"]),
            "power": len(params["p_power"]),
            "distance": len(params["p_distance"]),
        },
    )

    sb.rpc("upsert_streams_with_sport", params).execute()


def db_upsert_stream_arrays(
    *,
    user_id: int,
    activity_id: int,
    time_s: List[int],
    heartrate_bpm: Optional[List[int]] = None,
    cadence_rpm: Optional[List[int]] = None,
    power_w: Optional[List[int]] = None,
    distance_m: Optional[List[float]] = None,
    altitude_m: Optional[List[float]] = None,
    speed_mps: Optional[List[float]] = None,
    grade_smooth: Optional[List[float]] = None,
    temp_c: Optional[List[float]] = None,
    user_jwt: Optional[str] = None,
    service: bool = False,
):
    """
    Priamy upsert do public.activities_streams:
    - ak pole je None, nechávame ho tak (neprepíšeme ho NULLom)
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")

    payload: Dict[str, Any] = {
        "user_id": user_id,
        "activity_id": activity_id,
        "time_s": time_s,
    }

    if heartrate_bpm is not None:
        payload["heartrate_bpm"] = heartrate_bpm
    if cadence_rpm is not None:
        payload["cadence_rpm"] = cadence_rpm
    if power_w is not None:
        payload["power_w"] = power_w
    if distance_m is not None:
        payload["distance_m"] = distance_m
    if altitude_m is not None:
        payload["altitude_m"] = altitude_m
    if speed_mps is not None:
        payload["speed_mps"] = speed_mps
    if grade_smooth is not None:
        payload["grade_smooth"] = grade_smooth
    if temp_c is not None:
        payload["temp_c"] = temp_c

    _dbg_db(
        "db_upsert_stream_arrays payload keys:",
        sorted(list(payload.keys())),
    )
    _dbg_db(
        "db_upsert_stream_arrays payload sizes:",
        {
            "time_s": len(payload.get("time_s") or []),
            "heartrate_bpm": len(payload.get("heartrate_bpm") or []),
            "cadence_rpm": len(payload.get("cadence_rpm") or []),
            "power_w": len(payload.get("power_w") or []),
            "distance_m": len(payload.get("distance_m") or []),
            "altitude_m": len(payload.get("altitude_m") or []),
            "speed_mps": len(payload.get("speed_mps") or []),
            "grade_smooth": len(payload.get("grade_smooth") or []),
            "temp_c": len(payload.get("temp_c") or []),
        },
    )

    (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .upsert(payload, on_conflict="user_id,activity_id")
        .execute()
    )