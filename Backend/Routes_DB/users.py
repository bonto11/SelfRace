from __future__ import annotations

from typing import Any, Dict, Optional, List

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS


def db_get_user_by_auth_uid(
    auth_uid: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Nájde usera podľa auth_uid (Supabase auth používateľ).
    """
    sb = get_sb(ctx, caller="users.db_get_user_by_auth_uid")
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
    ctx: AuthCtx,
) -> Optional[str]:
    """
    Vráti auth_uid podľa interného user_id, alebo None.
    """
    sb = get_sb(ctx, caller="users.db_get_user_uid")
    res = sb.table(TABLE_USERS).select("auth_uid").eq("id", user_id).limit(1).execute()
    row = (res.data or [None])[0]
    if not row or not row.get("auth_uid"):
        return None
    return str(row["auth_uid"])


def db_get_user_by_email(
    email: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Nájde usera podľa mail_address.
    """
    sb = get_sb(ctx, caller="users.db_get_user_by_email")
    res = sb.table(TABLE_USERS).select("*").eq("mail_address", email).limit(1).execute()
    return (res.data or [None])[0]


def db_insert_user(
    payload: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vytvorí usera s daným payloadom.
    """
    sb = get_sb(ctx, caller="users.db_insert_user")
    res = sb.table(TABLE_USERS).insert(payload).execute()
    row = (res.data or [None])[0]
    if not row:
        raise RuntimeError("Insert user failed – empty response")
    return row


def db_update_user_by_email(
    email: str,
    fields: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Update usera podľa mail_address.
    """
    if not fields:
        return None
    sb = get_sb(ctx, caller="users.db_update_user_by_email")
    res = sb.table(TABLE_USERS).update(fields).eq("mail_address", email).execute()
    return (res.data or [None])[0]


def db_delete_user_by_email(
    email: str,
    *,
    ctx: AuthCtx,
) -> None:
    """
    Delete usera podľa mail_address.
    """
    sb = get_sb(ctx, caller="users.db_delete_user_by_email")

    sb.table(TABLE_USERS).delete().eq("mail_address", email).execute()


def db_list_users_for_cron(
    *,
    limit: int = 1000,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Základný zoznam userov pre cron/maintenance úlohy.

    Zatiaľ bez filtrov (všetci useri z TABLE_USERS). Ak pridáš stĺpec
    typu is_active / is_deleted, môžeš tu doplniť .eq("is_active", True) atď.
    """
    sb = get_sb(ctx, caller="users.db_list_users_for_cron")

    res = sb.table(TABLE_USERS).select("id, auth_uid").limit(limit).execute()
    return list(res.data or [])


def db_list_users_for_athlete_state(
    *,
    limit: int = 1000,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Zoznam userov vhodný pre batch analýzu atleta.

    Zatiaľ žiadne extra filtre (is_deleted/is_active) – ak ich budeš mať v TABLE_USERS,
    môžeš si tu doplniť .eq("is_deleted", False) a pod.
    """
    sb = get_sb(ctx, caller="users.db_list_users_for_athlete_state")

    try:
        res = (
            sb.table(TABLE_USERS)
            .select("id, auth_uid, mail_address")
            .order("id", desc=False)
            .limit(limit)
            .execute()
        )
        return list(res.data or [])
    except Exception:
        return []
