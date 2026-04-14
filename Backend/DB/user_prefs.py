# DB/user_prefs.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_PREFERENCES


def db_get_prefs_all(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_prefs.db_get_prefs_all")

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
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_prefs.db_get_pref_single")

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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="user_prefs.db_upsert_pref_single")

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
    ctx: AuthCtx,
) -> int:
    sb = get_sb(ctx, caller="user_prefs.db_upsert_many")

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
    ctx: AuthCtx,
) -> int:
    sb = get_sb(ctx, caller="user_prefs.db_delete_pref_single")

    res = (
        sb.table(TABLE_USERS_PREFERENCES)
        .delete()
        .eq("user_id", user_id)
        .eq("key", key)
        .execute()
    )
    return len(res.data or [])
