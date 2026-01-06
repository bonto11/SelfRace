from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_NOTES


def fetch_recent_notes(
    user_id: int,
    days: int = 28,
    *,
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Načíta poznámky usera za posledných N dní cez RLS (user_jwt).
    """
    try:
        sb = get_client(user_jwt=user_jwt)

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