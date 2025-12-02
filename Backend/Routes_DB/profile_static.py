# Routes_DB/profile_static.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_PROFILE_STATIC

supabase = get_client()


def db_fetch_static(user_id: int, user_uid: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Vytiahne static profil – preferuje user_uid, inak user_id.
    """
    q = supabase.table(TABLE_PROFILE_STATIC).select("*").limit(1)
    if user_uid:
        q = q.eq("user_uid", user_uid)
    else:
        q = q.eq("user_id", user_id)

    res = q.execute()
    data = res.data or []
    return data[0] if data else None


def db_upsert_static(data: Dict[str, Any], conflict_col: str) -> Dict[str, Any]:
    """
    Upsert static profilu, vracia uložený riadok.
    """
    res = supabase.table(TABLE_PROFILE_STATIC).upsert(
        data, on_conflict=conflict_col
    ).execute()
    if res.data:
        return res.data[0]
    return data