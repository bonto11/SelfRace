# Services/notes.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_USERS_NOTES,
)

supabase = get_client()

def fetch_recent_notes(user_id: int, days: int = 28):
    try:
        since_dt = datetime.now(timezone.utc) - timedelta(days=days)
        res = (
            supabase.table(TABLE_USERS_NOTES)
            .select("activity_id,feeling,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_dt.isoformat())
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []