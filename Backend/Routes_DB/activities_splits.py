from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_ACTIVITIES_SPLITS


def _get_sb(user_jwt: Optional[str]):
    """
    Vyberie správneho Supabase klienta:
    - ak máme user_jwt → RLS klient (get_client)
    - ak user_jwt=None → service klient (get_service_client)
    """
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    return get_service_client()


def db_delete_splits_for_activity(
    activity_id: int,
    user_jwt: Optional[str] = None,
) -> None:
    """
    Delete všetkých splits pre danú aktivitu.
    """
    sb = _get_sb(user_jwt)
    sb.table(TABLE_ACTIVITIES_SPLITS).delete().eq("activity_id", activity_id).execute()


def db_upsert_split(
    row: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> None:
    """
    Upsert jedného splitu pre aktivitu.
    """
    sb = _get_sb(user_jwt)
    sb.table(TABLE_ACTIVITIES_SPLITS).upsert(
        row,
        on_conflict="activity_id,split_index",
    ).execute()


def db_get_activity_splits(
    user_id: int,
    activity_id: int,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Všetky splits pre danú aktivitu daného usera.

    - s user_jwt: RLS (row-level security) klient
    - bez user_jwt: service role klient (webhook/worker)
    """
    sb = _get_sb(user_jwt)

    res = (
        sb.table(TABLE_ACTIVITIES_SPLITS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .order("split_index", desc=False)
        .execute()
    )
    return res.data or []