from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_ACTIVITIES_STREAMS


def _get_sb(user_jwt: Optional[str] = None):
    """
    - s user_jwt → RLS klient (anon + auth)
    - bez user_jwt → service role (worker/webhook)
    """
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    return get_service_client()


def db_get_streams_one(
    user_id: int,
    activity_id: int,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Jedna row so streamami pre danú aktivitu:
      { time_s: [...], heartrate_bpm: [...] }

    - s user_jwt: RLS čítanie pre FE/AI
    - bez user_jwt: service role pre worker/webhook
    """
    sb = _get_sb(user_jwt)
    res = (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .select("time_s,heartrate_bpm")
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
    user_jwt: Optional[str] = None,
) -> List[int]:
    """
    Vráti zoznam activity_id, pre ktoré už existuje aspoň jeden stream záznam.

    - typicky sync/worker → user_jwt=None (service role)
    - pre FE debug môže ísť aj s user_jwt
    """
    if not activity_ids:
        return []

    sb = _get_sb(user_jwt)
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
) -> None:
    """
    Volá SQL funkciu upsert_streams_with_sport(...) cez RPC.

    Používa sa pri 'rich' variante ukladania, kde si DB sama vytiahne
    sport_type_fe a user_uid zo summary.
    """
    sb = _get_sb(user_jwt)
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
    user_jwt: Optional[str] = None,
) -> None:
    """
    Jednoduchý upsert priamo do TABLE_ACTIVITIES_STREAMS (bez RPC).

    Používa sa v cache_streams_for_activities ako "light" verzia.
    """
    sb = _get_sb(user_jwt)

    row = {
        "activity_id": int(activity_id),
        "user_id": int(user_id),
        # user_uid a sport_type_fe môžeš doplniť neskôr cez worker,
        # tu ich necháme jednoduché/default:
        "user_uid": None,
        "sport_type_fe": "other",
        "time_s": [int(x) for x in time_s],
        "heartrate_bpm": [int(x) for x in heartrate_bpm] if heartrate_bpm else None,
        "cadence_rpm": [int(x) for x in cadence_rpm] if cadence_rpm else None,
        "power_w": [int(x) for x in power_w] if power_w else None,
        "distance_m": [float(x) for x in distance_m] if distance_m else None,
    }

    sb.table(TABLE_ACTIVITIES_STREAMS).upsert(
        row,
        on_conflict="activity_id",
    ).execute()