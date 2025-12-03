# Routes_DB/users.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_USERS

# read-only client (napr. pre FE čítanie)
sb_ro = get_client()
# service client (má mať práva na zápis)
sb_rw = get_service_client()


def db_get_user_by_auth_uid(auth_uid: str) -> Optional[Dict[str, Any]]:
    """
    Nájde usera podľa auth_uid (Supabase auth používateľ).
    """
    res = (
        sb_ro.table(TABLE_USERS)
        .select("id, auth_uid, mail_address")
        .eq("auth_uid", auth_uid)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_get_user_uid(user_id: int) -> Optional[str]:
    """
    Vráti auth_uid podľa interného user_id, alebo None.
    """
    res = (
        sb_ro.table(TABLE_USERS)
        .select("auth_uid")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0]
    if not row or not row.get("auth_uid"):
        return None
    return str(row["auth_uid"])


def db_get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Nájde usera podľa mail_address.
    """
    res = (
        sb_ro.table(TABLE_USERS)
        .select("*")
        .eq("mail_address", email)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_insert_user(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Vytvorí usera s daným payloadom.
    """
    res = sb_rw.table(TABLE_USERS).insert(payload).execute()
    row = (res.data or [None])[0]
    if not row:
        raise RuntimeError("Insert user failed – empty response")
    return row


def db_update_user_by_email(email: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update usera podľa mail_address.
    """
    if not fields:
        return None
    res = (
        sb_rw.table(TABLE_USERS)
        .update(fields)
        .eq("mail_address", email)
        .execute()
    )
    return (res.data or [None])[0]


def db_delete_user_by_email(email: str) -> None:
    """
    Delete usera podľa mail_address.
    """
    sb_rw.table(TABLE_USERS).delete().eq("mail_address", email).execute()