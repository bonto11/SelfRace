from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime
from Configs.config import TABLE_USERS_PREFERENCES
from Modules.SQL.db_handler import get_client
supabase = get_client()

def fetch_all_prefs(user_id: int) -> List[Dict[str, Any]]:
    res = (
        supabase.table(TABLE_USERS_PREFERENCES)
        .select("key,value,updated_at")
        .eq("user_id", user_id)
        .order("key", desc=False)
        .execute()
    )
    return list(res.data or [])

def fetch_pref(user_id: int, key: str) -> Optional[Dict[str, Any]]:
    res = (
        supabase.table(TABLE_USERS_PREFERENCES)
        .select("key,value,updated_at")
        .eq("user_id", user_id)
        .eq("key", key)
        .limit(1)
        .execute()
    )
    rows = list(res.data or [])
    return rows[0] if rows else None

def upsert_pref(user_id: int, key: str, value: Any) -> Dict[str, Any]:
    rec = {
        "user_id": user_id,
        "key": key,
        "value": value,
        "updated_at": datetime.utcnow().isoformat(),
    }
    supabase.table(TABLE_USERS_PREFERENCES).upsert(rec, on_conflict="user_id,key").execute()
    return rec

def upsert_many(user_id: int, kv: Dict[str, Any]) -> int:
    rows = [{
        "user_id": user_id,
        "key": k,
        "value": v,
        "updated_at": datetime.utcnow().isoformat(),
    } for k, v in kv.items()]
    if not rows: return 0
    supabase.table(TABLE_USERS_PREFERENCES).upsert(rows, on_conflict="user_id,key").execute()
    return len(rows)

def delete_pref(user_id: int, key: str) -> int:
    res = (
        supabase.table(TABLE_USERS_PREFERENCES)
        .delete()
        .eq("user_id", user_id)
        .eq("key", key)
        .execute()
    )
    return len(res.data or [])