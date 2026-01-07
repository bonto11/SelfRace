from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_PROFILE_STATIC

def _apply_user_filter(q, user_id: int, user_uid: Optional[str]):
    """
    Pomocná funkcia na filtrovanie podľa user_id / user_uid.
    """
    if user_uid:
        return q.eq("user_uid", user_uid)
    return q.eq("user_id", user_id)


def db_fetch_static(
    user_id: int,
    user_uid: Optional[str] = None,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Vytiahne static profil – preferuje user_uid, inak user_id.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="profile_static")

    q = sb.table(TABLE_PROFILE_STATIC).select("*").limit(1)
    q = _apply_user_filter(q, user_id=user_id, user_uid=user_uid)

    res = q.execute()
    data = res.data or []
    return data[0] if data else None


def db_upsert_static(
    data: Dict[str, Any],
    conflict_col: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Upsert static profilu, vracia uložený riadok.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="profile_static")

    res = (
        sb.table(TABLE_PROFILE_STATIC)
        .upsert(data, on_conflict=conflict_col)
        .execute()
    )
    if res.data:
        return res.data[0]
    return data


def db_fetch_static_basic(
    user_id: int,
    user_uid: Optional[str] = None,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="profile_static")

    q = sb.table(TABLE_PROFILE_STATIC).select("sex,birth_date,height_cm").limit(1)
    q = _apply_user_filter(q, user_id=user_id, user_uid=user_uid)
    res = q.execute()
    data = res.data or []
    return data[0] if data else None


def db_get_static_sex_birth(
    user_id: int,
    user_uid: Optional[str] = None,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="profile_static")

    q = sb.table(TABLE_PROFILE_STATIC).select("sex,birth_date").limit(1)
    q = _apply_user_filter(q, user_id=user_id, user_uid=user_uid)
    res = q.execute()
    data = res.data or []
    return data[0] if data else None


def db_fetch_user_sex(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[str]:
    """
    Jednoduchý helper na zistenie pohlavia usera (pod RLS alebo service).
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="profile_static")

    try:
        rec = (
            sb.table(TABLE_PROFILE_STATIC)
            .select("sex")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = (rec.data or [None])[0]
        return row.get("sex") if row else None
    except Exception:
        return None