# Routes_DB/user_zones.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

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
    except Exception:
        return []


def db_user_zones_fetch_latest(
    user_id: int,
    sport_raw: Optional[str] = None,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší riadok podľa user_id (+ voliteľne sport) alebo None.
    """
    sb = get_sb(ctx, caller="user_zones.db_user_zones_fetch_latest")

    try:
        q = (
            sb.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        if sport_raw:
            q = q.ilike("sport", sport_raw)
        res = q.limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def db_user_zones_insert_row(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Insert jedného riadku do users_zones.
    """
    sb = get_sb(ctx, caller="user_zones.db_user_zones_insert_row")

    res = sb.table(TABLE_USERS_ZONES).insert(row).execute()
    return (res.data or [{}])[0]


def db_user_zones_fetch_all_desc(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    return db_user_zones_fetch_all(ctx=ctx, user_id=user_id)
