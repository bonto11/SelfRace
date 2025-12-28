from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_USERS


def _get_sb(user_jwt: Optional[str]):
    """
    Ak je k dispozícii user_jwt → RLS klient.
    Inak fallback na service client (pôvodné správanie).
    """
    if user_jwt:
        return get_client(user_jwt=user_jwt)
    return get_service_client()


def db_get_user_by_auth_uid(
    auth_uid: str,
    *,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Nájde usera podľa auth_uid (Supabase auth používateľ).
    """
    sb = _get_sb(user_jwt)
    res = (
        sb.table(TABLE_USERS)
        .select("id, auth_uid, mail_address")
        .eq("auth_uid", auth_uid)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_get_user_uid(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
) -> Optional[str]:
    """
    Vráti auth_uid podľa interného user_id, alebo None.
    """
    sb = _get_sb(user_jwt)
    res = (
        sb.table(TABLE_USERS)
        .select("auth_uid")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0]
    if not row or not row.get("auth_uid"):
        return None
    return str(row["auth_uid"])


def db_get_user_by_email(
    email: str,
    *,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Nájde usera podľa mail_address.
    """
    sb = _get_sb(user_jwt)
    res = (
        sb.table(TABLE_USERS)
        .select("*")
        .eq("mail_address", email)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_insert_user(
    payload: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vytvorí usera s daným payloadom.
    Ak je user_jwt, ide to cez RLS klienta, inak service client.
    """
    sb = _get_sb(user_jwt)
    res = sb.table(TABLE_USERS).insert(payload).execute()
    row = (res.data or [None])[0]
    if not row:
        raise RuntimeError("Insert user failed – empty response")
    return row


def db_update_user_by_email(
    email: str,
    fields: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update usera podľa mail_address.
    """
    if not fields:
        return None
    sb = _get_sb(user_jwt)
    res = (
        sb.table(TABLE_USERS)
        .update(fields)
        .eq("mail_address", email)
        .execute()
    )
    return (res.data or [None])[0]


def db_delete_user_by_email(
    email: str,
    *,
    user_jwt: Optional[str] = None,
) -> None:
    """
    Delete usera podľa mail_address.
    """
    sb = _get_sb(user_jwt)
    sb.table(TABLE_USERS).delete().eq("mail_address", email).execute()