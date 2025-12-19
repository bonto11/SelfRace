from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_LAPS,
)

supabase = get_client()


def db_delete_laps_for_activity(activity_id: int) -> None:
    supabase.table(TABLE_ACTIVITIES_LAPS).delete().eq("activity_id", activity_id).execute()

def db_upsert_lap(row: Dict[str, Any]) -> None:
    supabase.table(TABLE_ACTIVITIES_LAPS).upsert(
        row,
        on_conflict="activity_id,lap_index",
    ).execute()

