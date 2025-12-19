from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_STREAMS,
)

supabase = get_client()

def db_get_streams_hr_rows(activity_id: int) -> List[Dict[str, Any]]:
    """
    Rady pre HR stream – berieme z TABLE_ACTIVITIES_STREAMS (time_s, hr).
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_STREAMS)
        .select("time_s,hr")
        .eq("activity_id", activity_id)
        .order("time_s")
        .execute()
    )
    return res.data or []