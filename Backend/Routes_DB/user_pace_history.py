from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_PACE_HISTORY

def db_get_latest_paces(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="pace_history.db_get_latest_paces")
    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .order("measured_at", desc=True)
        .limit(1)
        .execute()
    )

    print("db_get_latest_paces",res)

    return res.data[0] if res.data else None

def db_get_pace_trend(user_id: int, days: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="pace_history.db_get_pace_trend")
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .gte("measured_at", since_date)
        .order("measured_at", desc=False)
        .execute()
    )

    print("db_get_pace_trend",res)

    return res.data or []

def db_insert_pace_row(row: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="pace_history.db_insert_pace_row")
    res = sb.table(TABLE_USERS_PACE_HISTORY).insert(row).execute()
    return res.data[0] if res.data else {}