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