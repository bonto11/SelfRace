# Routes_DB/user_zones.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_USERS_ZONES


def db_user_zones_fetch_all(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Vráti VŠETKY riadky z users_zones pre daného usera, zoradené od najnovšieho.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="user_zones")

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
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší riadok podľa user_id (+ voliteľne sport) alebo None.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="user_zones")

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
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Insert jedného riadku do users_zones.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="user_zones")

    res = sb.table(TABLE_USERS_ZONES).insert(row).execute()
    return (res.data or [{}])[0]


def db_user_zones_fetch_all_desc(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    return db_user_zones_fetch_all(user_id, user_jwt=user_jwt, service=service)