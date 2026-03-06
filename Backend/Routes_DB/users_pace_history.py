# Routes_DB/users_pace_history.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_PACE_HISTORY


def db_save_pace_history(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="users_pace_history.db_save_pace_history")

    res = sb.table(TABLE_USERS_PACE_HISTORY).insert(row).execute()
    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else {}


def db_get_latest_paces(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="users_pace_history.db_get_latest_paces")

    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .order("measured_at", desc=True)
        .limit(1)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else None


def db_get_pace_history_trends(
    user_id: int,
    days: int = 90,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="users_pace_history.db_get_pace_history_trends")
    
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .gte("measured_at", since_date)
        .order("measured_at", desc=False) # FE grafy potrebujú od najstaršieho po najnovšie
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []

    return rows
