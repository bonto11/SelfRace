# Routes_DB/user_zones.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_ZONES


def db_user_zones_fetch_all(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_all")

    res = (
        sb.table(TABLE_USERS_ZONES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    
    rows: List[Dict[str, Any]] = res.data or []
    
    return rows


def db_user_zones_fetch_latest(
    user_id: int,
    sport_raw: Optional[str] = None,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_latest")

    q = sb.table(TABLE_USERS_ZONES).select("*").eq("user_id", user_id)
    if sport_raw:
        q = q.ilike("sport", sport_raw)
        
    res = q.order("created_at", desc=True).limit(1).execute()
    
    rows: List[Dict[str, Any]] = res.data or []
    
    return rows[0] if rows else None


def db_user_zones_fetch_trends(
    user_id: int,
    sport_raw: str = "run",
    days: int = 90,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_trends")
    
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    
    res = (
        sb.table(TABLE_USERS_ZONES)
        .select("*")
        .eq("user_id", user_id)
        .ilike("sport", sport_raw)
        .gte("created_at", since_date)
        .order("created_at", desc=False)
        .execute()
    )
    
    rows: List[Dict[str, Any]] = res.data or []
    
    return rows


def db_user_zones_insert_row(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="user_zones.db_user_zones_insert_row")

    res = sb.table(TABLE_USERS_ZONES).insert(row).execute()
    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else {}


def db_user_zones_fetch_all_desc(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    return db_user_zones_fetch_all(ctx=ctx, user_id=user_id)
