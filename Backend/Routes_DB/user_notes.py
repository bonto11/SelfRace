from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_NOTES


def fetch_recent_notes(
    user_id: int,
    days: int = 28,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načíta poznámky usera za posledných N dní cez RLS (user_jwt).
    """
    try:
        sb = get_sb(ctx, caller="user_notes.fetch_recent_notes")

        since_dt = datetime.now(timezone.utc) - timedelta(days=days)
        res = (
            sb.table(TABLE_USERS_NOTES)
            .select("activity_id,feeling,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_dt.isoformat())
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []
