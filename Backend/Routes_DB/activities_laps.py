from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_ACTIVITIES_LAPS


def _get_sb(user_jwt: Optional[str]):
    """
    Vyberie správneho Supabase klienta:
    - ak máme user_jwt → RLS klient (get_client)
    - ak user_jwt=None → service klient (get_service_client)
    """
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    return get_service_client()


def db_delete_laps_for_activity(
    activity_id: int,
    user_jwt: Optional[str] = None,
) -> None:
    """
    Delete všetkých laps pre danú aktivitu.
    """
    sb = _get_sb(user_jwt)
    sb.table(TABLE_ACTIVITIES_LAPS).delete().eq("activity_id", activity_id).execute()


def db_upsert_lap(
    row: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> None:
    """
    Upsert jedného lapu pre aktivitu.
    """
    sb = _get_sb(user_jwt)
    sb.table(TABLE_ACTIVITIES_LAPS).upsert(
        row,
        on_conflict="activity_id,lap_index",
    ).execute()


def db_get_activity_laps(
    user_id: int,
    activity_id: int,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Všetky laps pre danú aktivitu daného usera.

    - s user_jwt: RLS read pre FE/AI
    - bez user_jwt: interné servisy / worker cez service klienta
    """
    sb = _get_sb(user_jwt)

    res = (
        sb.table(TABLE_ACTIVITIES_LAPS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .order("lap_index", desc=False)
        .execute()
    )
    return res.data or []