# Services/users_health_log.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.Routes_DB.user_health_log import (
    db_insert_health_logs,
    db_update_health_log,
    db_delete_health_log,
    db_get_active_health_logs,
    db_get_all_health_logs,
)
from Modules.Supabase.auth import AuthCtx

def service_get_active_health(user_id: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_active_health_logs(user_id, ctx=ctx)

def service_get_health_history(user_id: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_all_health_logs(user_id, ctx=ctx)

def service_save_health_logs(user_id: int, logs_payload: List[Dict[str, Any]], ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    Spracuje a uloží jeden alebo viac záznamov naraz. 
    Očakáva payload v tvare zoznamu objektov.
    """
    rows_to_insert = []
    
    for item in logs_payload:
        event_type = str(item.get("event_type", "")).strip().lower()
        severity = int(item.get("severity", 5))
        
        # Validácia
        if event_type not in ["injury", "illness", "fatigue"]:
            raise ValueError(f"Invalid event_type: {event_type}")
        if severity < 1 or severity > 10:
            raise ValueError(f"Severity must be between 1 and 10. Got: {severity}")
            
        row = {
            "user_id": user_id,
            "event_type": event_type,
            "status": str(item.get("status", "active")).strip().lower(),
            "severity": severity,
            "start_date": item.get("start_date") or datetime.now(timezone.utc).date().isoformat(),
            "end_date": item.get("end_date"),
            "details": item.get("details") or {},
            "notes": item.get("notes")
        }
        rows_to_insert.append(row)

    if not rows_to_insert:
        return []

    return db_insert_health_logs(rows_to_insert, ctx=ctx)

def service_resolve_health_log(user_id: int, log_id: int, end_date: Optional[str], ctx: AuthCtx) -> Dict[str, Any]:
    """
    Označí záznam za vyriešený. Ak nedostane end_date, použije dnešný dátum.
    """
    updates = {
        "status": "resolved",
        "end_date": end_date or datetime.now(timezone.utc).date().isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    updated_row = db_update_health_log(log_id=log_id, user_id=user_id, updates=updates, ctx=ctx)
    if not updated_row:
        raise ValueError(f"Failed to resolve health log {log_id}. It might not exist or belong to user.")
        
    return updated_row

def service_delete_health_log(user_id: int, log_id: int, ctx: AuthCtx) -> bool:
    return db_delete_health_log(log_id=log_id, user_id=user_id, ctx=ctx)