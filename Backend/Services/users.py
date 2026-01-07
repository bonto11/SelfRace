from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import HTTPException

from Routes_DB.users import (
    db_get_user_by_auth_uid,
    db_get_user_uid,
    db_get_user_by_email,
    db_insert_user,
    db_update_user_by_email,
    db_delete_user_by_email,
)


def require_jwt(user_jwt: Optional[str]) -> str:
    if not user_jwt:
        raise HTTPException(status_code=401, detail="Missing Authorization JWT")
    return user_jwt


def service_resolve_user(
    auth_uid: str,
    user_jwt: Optional[str] = None,
) -> Optional[int]:
    """
    Resolve /users/resolve – nájde user_id podľa auth_uid.
    DB vrstva sama rieši RLS vs service-role podľa user_jwt.
    """
    row = db_get_user_by_auth_uid(auth_uid, user_jwt=user_jwt)
    if not row:
        return None
    return int(row["id"])


def service_get_user_uid(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> str:
    """
    Vráti auth_uid pre dané user_id, alebo hodí RuntimeError ak chýba.
    """
    uid = db_get_user_uid(user_id, user_jwt=user_jwt)
    if not uid:
        raise RuntimeError(f"user_id={user_id} nemá auth_uid v public.users")
    return uid


def service_create_user(
    name: str,
    age: int,
    mail_address: str,
    display_name: Optional[str] = None,
    auth_uid: Optional[str] = None,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vytvorí usera, ak daný e-mail ešte v DB nie je.
    Môže bežať pod RLS (JWT) aj pod service rolou (bez JWT).
    """
    existing = db_get_user_by_email(mail_address, user_jwt=user_jwt)
    if existing:
        print(f"E-mail {mail_address} už existuje. Nevkladám.")
        return existing

    payload: Dict[str, Any] = {
        "name": name,
        "age": age,
        "mail_address": mail_address,
        "display_name": display_name or name,
    }
    if auth_uid:
        payload["auth_uid"] = auth_uid

    row = db_insert_user(payload, user_jwt=user_jwt)
    print("Úspešne vložené:", row)
    return row


def service_get_user_by_email(
    mail_address: str,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Wrapper na get by email.
    """
    return db_get_user_by_email(mail_address, user_jwt=user_jwt)


def service_update_user(
    mail_address: str,
    user_jwt: Optional[str] = None,
    **fields: Any,
) -> Optional[Dict[str, Any]]:
    """
    Update podľa mail_address.
    """
    if not fields:
        return None
    return db_update_user_by_email(mail_address, fields, user_jwt=user_jwt)


def service_delete_user(
    mail_address: str,
    user_jwt: Optional[str] = None,
) -> None:
    """
    Delete podľa mail_address.
    """
    db_delete_user_by_email(mail_address, user_jwt=user_jwt)


def service_get_or_create_user_id(
    email: str,
    *,
    name: str = "New User",
    display_name: Optional[str] = None,
    auth_uid: Optional[str] = None,
    user_jwt: Optional[str] = None,
) -> int:
    """
    get_or_create user podľa e-mailu – funguje aj pod RLS, aj pod service role.
    """
    user = db_get_user_by_email(email, user_jwt=user_jwt)
    if not user:
        print(f"Užívateľ {email} neexistuje, vytváram ho.")
        service_create_user(
            name=name,
            age=0,
            mail_address=email,
            display_name=display_name or name,
            auth_uid=auth_uid,
            user_jwt=user_jwt,
        )
        user = db_get_user_by_email(email, user_jwt=user_jwt)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return int(user["id"])
