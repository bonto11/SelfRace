# Routes_DB/users_health_log.py
from __future__ import annotations
from typing import Any, Dict, List, Optional
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

TABLE_USERS_HEALTH_LOG = "users_health_log"

def db_insert_health_logs(rows: List[Dict[str, Any]], *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Hromadný insert jedného alebo viacerých záznamov."""
    if not rows:
        return []
    sb = get_sb(ctx, caller="users_health_log.db_insert_health_logs")
    res = sb.table(TABLE_USERS_HEALTH_LOG).insert(rows).execute()
    return res.data or []

def db_update_health_log(log_id: int, user_id: int, updates: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """Update konkrétneho záznamu (napríklad označenie za vyriešené 'resolved' a pridanie end_date)."""
    sb = get_sb(ctx, caller="users_health_log.db_update_health_log")
    res = (
        sb.table(TABLE_USERS_HEALTH_LOG)
        .update(updates)
        .eq("id", log_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None

def db_delete_health_log(log_id: int, user_id: int, *, ctx: AuthCtx) -> bool:
    """Vymazanie omylom pridaného záznamu."""
    sb = get_sb(ctx, caller="users_health_log.db_delete_health_log")
    res = (
        sb.table(TABLE_USERS_HEALTH_LOG)
        .delete()
        .eq("id", log_id)
        .eq("user_id", user_id)
        .execute()
    )
    # Ak sa niečo vymazalo, data nebudú prázdne (závisí od Supabase klienta, niekedy vracia zmazaný riadok)
    return True

def db_get_active_health_logs(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Vráti len tie záznamy, ktoré stále trvajú (status = 'active'). Dôležité pre AI."""
    sb = get_sb(ctx, caller="users_health_log.db_get_active_health_logs")
    res = (
        sb.table(TABLE_USERS_HEALTH_LOG)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("start_date", desc=True)
        .execute()
    )
    return res.data or []

def db_get_all_health_logs(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Vráti kompletnú históriu chorôb a zranení používateľa."""
    sb = get_sb(ctx, caller="users_health_log.db_get_all_health_logs")
    res = (
        sb.table(TABLE_USERS_HEALTH_LOG)
        .select("*")
        .eq("user_id", user_id)
        .order("start_date", desc=True)
        .execute()
    )
    return res.data or []