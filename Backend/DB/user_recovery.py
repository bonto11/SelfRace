# DB/user_recovery.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_RECOVERY


def db_get_recovery_record(
    user_id: int,
    date_iso: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti {"id": ...} ak existuje recovery pre daný deň, inak None.
    """
    sb = get_sb(ctx, caller="user_recovery.db_get_recovery_record")

    res = (
        sb.table(TABLE_USERS_RECOVERY)
        .select("id")
        .eq("user_id", user_id)
        .eq("date", date_iso)
        .limit(1)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else None


def db_insert_recovery(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    sb = get_sb(ctx, caller="user_recovery.db_insert_recovery")

    res = sb.table(TABLE_USERS_RECOVERY).insert(row).execute()
    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else {}


def db_update_recovery(
    rec_id: int,
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    sb = get_sb(ctx, caller="user_recovery.db_update_recovery")
    res = sb.table(TABLE_USERS_RECOVERY).update(row).eq("id", rec_id).execute()

    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else {}


def db_get_recent_recovery(
    user_id: int,
    days: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_recovery.db_get_recent_recovery")

    res = (
        sb.table(TABLE_USERS_RECOVERY)
        .select("*")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(days)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []

    return rows
    
def db_get_recovery_for_month(
    user_id: int,
    year: int,
    month: int,
    *,
    ctx: "AuthCtx",
) -> "List[Dict[str, Any]]":
    """Recovery záznamy za daný mesiac."""
    from calendar import monthrange
    _, last_day = monthrange(year, month)
    date_from = f"{year}-{month:02d}-01"
    date_to   = f"{year}-{month:02d}-{last_day:02d}"

    sb = get_sb(ctx, caller="user_recovery.db_get_recovery_for_month")
    res = (
        sb.table(TABLE_USERS_RECOVERY)
        .select("HRV_avg_ms,RHR_bpm,sleep_duration_min,sleep_start_time")
        .eq("user_id", user_id)
        .gte("date", date_from)
        .lte("date", date_to)
        .execute()
    )
    return res.data or []

