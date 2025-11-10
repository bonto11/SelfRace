# Routes/coach_context.py
from __future__ import annotations
from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_USERS_THRESHOLDS
)

supabase = get_client()

def fetch_user_thresholds(user_id: int) -> list[dict]:
    try:
        res = (
            supabase.table(TABLE_USERS_THRESHOLDS)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []