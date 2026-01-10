from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_STREAMS


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
    return data[0] if data else None


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
    Ak chceš, vieme potom updatnuť aj samotnú SQL funkciu.
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