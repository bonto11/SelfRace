# Routes/coach_context.py
from __future__ import annotations
from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_USERS
)

supabase = get_client()

def get_user_uid(user_id: int) -> str:
    r = (
        supabase.table(TABLE_USERS)
        .select("auth_uid")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (r.data or [None])[0]
    if not row or not row.get("auth_uid"):
        raise RuntimeError(f"user_id={user_id} nemá auth_uid v public.users")
    return str(row["auth_uid"])
