from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_STREAMS


def _now_iso() -> str:
    # UTC ISO pre porovnanie v PostgREST filtroch
    return datetime.now(timezone.utc).isoformat()


def db_get_streams_one(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Jedna row so streamami pre danú aktivitu.
    Vracia len platné dáta:
      - deleted_at IS NULL
      - expires_at > now()
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")
    now = _now_iso()

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
        .is_("deleted_at", "null")
        .gt("expires_at", now)
        .limit(1)
        .execute()
    )

    data = res.data or []
    if not data:
        return None
    return data[0]


def db_get_streams_ids_present(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[int]:
    """
    Vráti activity_id, ktoré majú PLATNÉ streamy (nie expirované).
    """
    if not activity_ids:
        return []

    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")
    now = _now_iso()

    res = (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .select("activity_id")
        .eq("user_id", user_id)
        .in_("activity_id", list(set(activity_ids)))
        .is_("deleted_at", "null")
        .gt("expires_at", now)
        .execute()
    )

    rows = res.data or []
    out: List[int] = []
    for r in rows:
        try:
            out.append(int(r["activity_id"]))
        except Exception:
            pass
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
    RPC upsert.
    Dôležité: expires_at neriešime tu — DB default pri INSERT,
    a pri UPSERT ho nemeníme (RPC nech to nerieši vôbec).
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
    moving: Optional[List[bool]] = None,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Priamy upsert do activities_streams.
    - expires_at neposielame -> DB default pri INSERT, pri UPSERT sa nemení.
    - deleted_at tiež nemeníme tu.
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
    if moving is not None:
        payload["moving"] = moving

    (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .upsert(payload, on_conflict="user_id,activity_id")
        .execute()
    )