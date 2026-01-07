from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_LAPS


def db_delete_laps_for_activity(
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Delete všetkých laps pre danú aktivitu.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_laps")
    sb.table(TABLE_ACTIVITIES_LAPS).delete().eq("activity_id", activity_id).execute()


def db_upsert_lap(
    row: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Upsert jedného lapu pre aktivitu.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_laps")
    sb.table(TABLE_ACTIVITIES_LAPS).upsert(
        row,
        on_conflict="activity_id,lap_index",
    ).execute()


def db_get_activity_laps(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Všetky laps pre danú aktivitu daného usera.

    - FE/AI:    user_jwt=jwt
    - worker:   service=True
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_laps")

    res = (
        sb.table(TABLE_ACTIVITIES_LAPS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .order("lap_index", desc=False)
        .execute()
    )
    return res.data or []