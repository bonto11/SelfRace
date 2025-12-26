from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_SPLITS,
)

supabase = get_client()


def db_delete_splits_for_activity(activity_id: int) -> None:
    supabase.table(TABLE_ACTIVITIES_SPLITS).delete().eq("activity_id", activity_id).execute()


def db_upsert_split(row: Dict[str, Any]) -> None:
    supabase.table(TABLE_ACTIVITIES_SPLITS).upsert(
        row,
        on_conflict="activity_id,split_index",
    ).execute()


def db_get_activity_splits(user_id: int, activity_id: int) -> List[Dict[str, Any]]:
    """
    Všetky splits pre danú aktivitu daného usera.
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_SPLITS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .order("split_index", desc=False)
        .execute()
    )
    return res.data or []