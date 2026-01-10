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
    }
    sb.rpc("upsert_streams_with_sport", params).execute()


def db_upsert_stream_arrays(
    user_id: int,
    activity_id: int,
    *,
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
    Jednoduchý upsert priamo do TABLE_ACTIVITIES_STREAMS (bez RPC).

    Nové polia:
      - altitude_m
      - speed_mps
      - grade_smooth
      - temp_c
      - moving
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_streams")

    row = {
        "activity_id": int(activity_id),
        "user_id": int(user_id),
        "user_uid": None,
        "sport_type_fe": "other",
        "time_s": [int(x) for x in time_s],
        "heartrate_bpm": [int(x) for x in heartrate_bpm] if heartrate_bpm else None,
        "cadence_rpm": [int(x) for x in cadence_rpm] if cadence_rpm else None,
        "power_w": [int(x) for x in power_w] if power_w else None,
        "distance_m": [float(x) for x in distance_m] if distance_m else None,
        "altitude_m": [float(x) for x in altitude_m] if altitude_m else None,
        "speed_mps": [float(x) for x in speed_mps] if speed_mps else None,
        "grade_smooth": [float(x) for x in grade_smooth] if grade_smooth else None,
        "temp_c": [float(x) for x in temp_c] if temp_c else None,
        "moving": [bool(x) for x in moving] if moving else None,
    }

    sb.table(TABLE_ACTIVITIES_STREAMS).upsert(
        row,
        on_conflict="activity_id",
    ).execute()