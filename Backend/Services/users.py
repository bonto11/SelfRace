from __future__ import annotations

from typing import Any, Dict, Optional

from DB.users import (
    db_get_user_by_auth_uid,
    db_get_auth_uid,
    db_get_user_by_email,
    db_insert_user,
    db_update_user_by_email,
    db_delete_user_by_email,
    db_get_user_display_name,
    db_update_user_display_name,
)

from Modules.Supabase.auth import AuthCtx


def service_resolve_user(
    auth_uid: str,
    ctx: AuthCtx,
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
    ctx: AuthCtx,
) -> str:
    """
    Vráti auth_uid pre dané user_id, alebo hodí RuntimeError ak chýba.

    Režimy:
      - service=False (default): RLS klient → require_jwt
      - service=True: service klient → user_jwt sa len forwarduje (môže byť aj None)
    """
    uid = db_get_auth_uid(user_id=user_id, ctx=ctx)
    if not uid:
        raise RuntimeError(f"user_id={user_id} nemá auth_uid v public.users")
    return uid


def service_create_user(
    name: str,
    age: int,
    mail_address: str,
    ctx: AuthCtx,
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
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Wrapper na get by email.
    """
    return db_get_user_by_email(mail_address, ctx=ctx)


def service_update_user(
    mail_address: str,
    ctx: AuthCtx,
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
    ctx: AuthCtx,
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
    ctx: AuthCtx,
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
            ctx=ctx,
        )
        user = db_get_user_by_email(email, ctx=ctx)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return int(user["id"])


DISPLAY_NAME_MAX = 40


def service_get_display_name(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Meno usera v appke (users.display_name)."""
    return {"ok": True, "display_name": db_get_user_display_name(user_id, ctx=ctx) or ""}


def service_set_display_name(user_id: int, display_name: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Uloží meno do users.display_name. PREČO vlastné pole a nie meno z auth:
    prihlásenie cez Google prepisuje user_metadata menom z Google účtu,
    display_name ostáva voľbou usera (oslovuje ním AI tréner, vidí ho tréner).
    """
    name = " ".join(str(display_name or "").split())[:DISPLAY_NAME_MAX]
    if not name:
        return {"ok": False, "code": "name_empty"}
    try:
        if not db_update_user_display_name(user_id, name, ctx=ctx):
            return {"ok": False, "code": "save_failed"}
    except Exception as e:  # noqa: BLE001
        print(f"[USERS] set display_name failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "display_name": name}


APP_SEEN_KEY = "app.seen"
APP_PLATFORMS = ("ios", "android", "desktop")


def service_mark_app_seen(user_id: int, standalone: bool, platform: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Zapíše, že user otvoril appku (users_preferences app.seen) – pre admin prehľad.
    PREČO vlastný kľúč a nie stĺpec: bez zmeny schémy; FE volá najviac raz za pár hodín.
    last_standalone_at = otvorené ako appka z plochy (PWA).
    """
    from datetime import datetime, timezone

    from DB.user_prefs import db_get_pref_single, db_upsert_pref_single

    now = datetime.now(timezone.utc).isoformat()
    plat = platform if platform in APP_PLATFORMS else "desktop"
    try:
        row = db_get_pref_single(user_id, APP_SEEN_KEY, ctx=ctx)
        prev = (row or {}).get("value")
        prev = prev if isinstance(prev, dict) else {}
        platforms = prev.get("platforms") if isinstance(prev.get("platforms"), dict) else {}
        value = {
            "first_seen_at": prev.get("first_seen_at") or now,
            "last_seen_at": now,
            "last_standalone_at": now if standalone else prev.get("last_standalone_at"),
            "platform": plat,
            "platforms": {**platforms, plat: now},
        }
        db_upsert_pref_single(user_id, APP_SEEN_KEY, value, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[USERS] app seen failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "save_failed"}
    return {"ok": True}

