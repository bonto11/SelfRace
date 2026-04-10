from __future__ import annotations

from typing import Any, Dict, Optional

from Routes_DB.users import (
    db_get_user_by_auth_uid,
    db_get_auth_uid,
    db_get_user_by_email,
    db_insert_user,
    db_update_user_by_email,
    db_delete_user_by_email,
)

from Modules.Supabase.auth import AuthCtx




def service_resolve_user(
    auth_uid: str,
    ctx:AuthCtx,
) -> Optional[int]:
    """
    Resolve /users/resolve – nájde user_id podľa auth_uid.
    DB vrstva sama rieši RLS vs service-role podľa user_jwt.
    """
    row = db_get_user_by_auth_uid(auth_uid, ctx=ctx)
    if not row:
        return None
    return int(row["id"])


def service_get_auth_uid(
    user_id: int,
    ctx:AuthCtx,
) -> str:
    """
    Vráti auth_uid pre dané user_id, alebo hodí RuntimeError ak chýba.

    Režimy:
      - service=False (default): RLS klient → require_jwt
      - service=True: service klient → user_jwt sa len forwarduje (môže byť aj None)
    """
    uid = db_get_auth_uid(
        user_id=user_id,
        ctx=ctx
    )
    if not uid:
        raise RuntimeError(f"user_id={user_id} nemá auth_uid v public.users")
    return uid


def service_create_user(
    name: str,
    age: int,
    mail_address: str,
    ctx:AuthCtx,
    display_name: Optional[str] = None,
    auth_uid: Optional[str] = None,

) -> Dict[str, Any]:
    """
    Vytvorí usera, ak daný e-mail ešte v DB nie je.
    Môže bežať pod RLS (JWT) aj pod service rolou (bez JWT).
    """
    existing = db_get_user_by_email(mail_address, ctx=ctx)
    if existing:
        return existing

    payload: Dict[str, Any] = {
        "name": name,
        "age": age,
        "mail_address": mail_address,
        "display_name": display_name or name,
    }
    if auth_uid:
        payload["auth_uid"] = auth_uid

    row = db_insert_user(payload=payload, ctx=ctx)

    return row


def service_get_user_by_email(
    mail_address: str,
    ctx:AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Wrapper na get by email.
    """
    return db_get_user_by_email(mail_address, ctx=ctx)


def service_update_user(
    mail_address: str,
    ctx:AuthCtx,
    **fields: Any,
) -> Optional[Dict[str, Any]]:
    """
    Update podľa mail_address.
    """
    if not fields:
        return None
    return db_update_user_by_email(mail_address, fields, ctx=ctx)


def service_delete_user(
    mail_address: str,
    ctx:AuthCtx,
) -> None:
    """
    Delete podľa mail_address.
    """
    db_delete_user_by_email(mail_address, ctx=ctx)


def service_get_or_create_user_id(
    email: str,
    *,
    name: str = "New User",
    display_name: Optional[str] = None,
    auth_uid: Optional[str] = None,
    ctx:AuthCtx,
) -> int:
    """
    get_or_create user podľa e-mailu – funguje aj pod RLS, aj pod service role.
    """
    user = db_get_user_by_email(email, ctx=ctx)
    if not user:
        service_create_user(
            name=name,
            age=0,
            mail_address=email,
            display_name=display_name or name,
            auth_uid=auth_uid,
            ctx=ctx
        )
        user = db_get_user_by_email(email, ctx=ctx)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return int(user["id"])
