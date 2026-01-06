# Routes_DB/user_prefs.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_USERS_PREFERENCES


def _get_sb(user_jwt: Optional[str] = None):
    """
    - ak máme user_jwt → RLS klient (FE / AI)
    - ak user_jwt=None → service klient (worker / admin skripty)
    """
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    return get_service_client()


def db_get_prefs_all(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    sb = _get_sb(user_jwt)

    res = (
        sb.table(TABLE_USERS_PREFERENCES)
        .select("key,value,updated_at")
        .eq("user_id", user_id)
        .order("key", desc=False)
        .execute()
    )

    return list(res.data or [])


def db_get_pref_single(
    user_id: int,
    key: str,
    *,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    sb = _get_sb(user_jwt)

    res = (
        sb.table(TABLE_USERS_PREFERENCES)
        .select("key,value,updated_at")
        .eq("user_id", user_id)
        .eq("key", key)
        .limit(1)
        .execute()
    )
    rows = list(res.data or [])

    return rows[0] if rows else None


def db_upsert_pref_single(
    user_id: int,
    key: str,
    value: Any,
    *,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    sb = _get_sb(user_jwt)

    rec = {
        "user_id": user_id,
        "key": key,
        "value": value,
        "updated_at": datetime.utcnow().isoformat(),
    }
    sb.table(TABLE_USERS_PREFERENCES).upsert(
        rec,
        on_conflict="user_id,key",
    ).execute()

    return rec


def db_upsert_many(
    user_id: int,
    kv: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
) -> int:
    sb = _get_sb(user_jwt)

    rows = [
        {
            "user_id": user_id,
            "key": k,
            "value": v,
            "updated_at": datetime.utcnow().isoformat(),
        }
        for k, v in kv.items()
    ]
    if not rows:
        return 0

    sb.table(TABLE_USERS_PREFERENCES).upsert(
        rows,
        on_conflict="user_id,key",
    ).execute()
    return len(rows)


def db_delete_pref_single(
    user_id: int,
    key: str,
    *,
    user_jwt: Optional[str] = None,
) -> int:
    sb = _get_sb(user_jwt)

    res = (
        sb.table(TABLE_USERS_PREFERENCES)
        .delete()
        .eq("user_id", user_id)
        .eq("key", key)
        .execute()
    )
    return len(res.data or [])