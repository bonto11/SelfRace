from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_ACTIVITIES_SPLITS


def _get_sb(
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
):
    """
    - service=True      → service-role klient (worker/webhook)
    - user_jwt != None  → RLS klient (FE/AI)
    """
    if service:
        return get_service_client()
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    raise RuntimeError(
        "activities_splits: missing user_jwt or service=True in DB helper"
    )


def db_delete_splits_for_activity(
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Delete všetkých splits pre danú aktivitu.
    """
    sb = _get_sb(user_jwt=user_jwt, service=service)
    sb.table(TABLE_ACTIVITIES_SPLITS).delete().eq("activity_id", activity_id).execute()


def db_upsert_split(
    row: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Upsert jedného splitu pre aktivitu.
    """
    sb = _get_sb(user_jwt=user_jwt, service=service)
    sb.table(TABLE_ACTIVITIES_SPLITS).upsert(
        row,
        on_conflict="activity_id,split_index",
    ).execute()


def db_get_activity_splits(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Všetky splits pre danú aktivitu daného usera.

    - FE/AI:    user_jwt=jwt
    - worker:   service=True
    """
    sb = _get_sb(user_jwt=user_jwt, service=service)

    res = (
        sb.table(TABLE_ACTIVITIES_SPLITS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .order("split_index", desc=False)
        .execute()
    )
    return res.data or []