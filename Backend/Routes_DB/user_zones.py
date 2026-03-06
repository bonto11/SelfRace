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
    """
    Vráti VŠETKY riadky z users_zones pre daného usera, zoradené od najnovšieho.
    """
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_all")

    try:
        res = (
            sb.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[DB_ZONES] Error fetching all zones: {e}")
        return []


def db_user_zones_fetch_latest(
    user_id: int,
    sport_raw: Optional[str] = None,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší riadok podľa user_id (+ voliteľne sport).
    """
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_latest")

    try:
        q = sb.table(TABLE_USERS_ZONES).select("*").eq("user_id", user_id)
        if sport_raw:
            q = q.ilike("sport", sport_raw)
            
        res = q.order("created_at", desc=True).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[DB_ZONES] Error fetching latest zones: {e}")
        return None


def db_user_zones_fetch_trends(
    user_id: int,
    sport_raw: str = "run",
    days: int = 90,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti históriu zón za určené obdobie (default 90 dní) pre konkrétny šport.
    Zoradené vzostupne pre FE grafy.
    """
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_trends")
    
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        res = (
            sb.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .ilike("sport", sport_raw)
            .gte("created_at", since_date)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[DB_ZONES] Error fetching zone trends: {e}")
        return []


def db_user_zones_insert_row(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Insert jedného riadku do users_zones.
    """
    sb = get_sb(ctx, caller="user_zones.db_user_zones_insert_row")

    try:
        res = sb.table(TABLE_USERS_ZONES).insert(row).execute()
        return (res.data or [{}])[0]
    except Exception as e:
        print(f"[DB_ZONES] Error inserting zone row: {e}")
        return {}


def db_user_zones_fetch_all_desc(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    return db_user_zones_fetch_all(ctx=ctx, user_id=user_id)
