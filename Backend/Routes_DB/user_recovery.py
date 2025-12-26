# Routes_DB/user_recovery.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_RECOVERY

def db_get_recovery_record(
    user_id: int,
    date_iso: str,
    *,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Vráti {"id": ...} ak existuje recovery pre daný deň, inak None.
    """
    sb = get_client(user_jwt=user_jwt)

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
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    sb = get_client(user_jwt=user_jwt)

    res = sb.table(TABLE_USERS_RECOVERY).insert(row).execute()
    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else {}


def db_update_recovery(
    rec_id: int,
    row: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    sb = get_client(user_jwt=user_jwt)

    res = (
        sb.table(TABLE_USERS_RECOVERY)
        .update(row)
        .eq("id", rec_id)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else {}


def db_get_recent_recovery(
    user_id: int,
    days: int,
    *,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    sb = get_client(user_jwt=user_jwt)

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