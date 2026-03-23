# Services/users_health_log.py
from __future__ import annotations
import time # ✅ PRIDANÝ IMPORT
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Routes_DB.user_health_log import (
    db_insert_health_logs,
    db_update_health_log,
    db_delete_health_log,
    db_get_active_health_logs,
    db_get_all_health_logs,
)
from Routes_DB.coach_plan_weekly import (
    db_delete_future_weekly_plans,
    db_check_weekly_data_exists
)
from Routes_DB.coach_plan_daily import db_delete_future_daily_plans
from Services.async_jobs import service_enqueue_job

from Modules.Supabase.auth import AuthCtx

def service_get_active_health(user_id: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_active_health_logs(user_id, ctx=ctx)

def service_get_health_history(user_id: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_all_health_logs(user_id, ctx=ctx)

def service_save_health_logs(user_id: int, logs_payload: List[Dict[str, Any]], ctx: AuthCtx) -> List[Dict[str, Any]]:
    rows_to_insert = []
    
    for item in logs_payload:
        event_type = str(item.get("event_type", "")).strip().lower()
        severity = int(item.get("severity", 5))
        
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


def service_adapt_plan_for_health(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    active_logs = db_get_active_health_logs(user_id=user_id, ctx=ctx)
    ts = int(time.time()) # ✅ UNIKÁTNY TIMESTAMP

    if not active_logs:
        service_enqueue_job(
            user_id=user_id,
            job_type="coach_autoadjust",
            payload={"force_reason": "health_resolved"},
            priority=90,
            dedupe_key=f"coach_autoadjust_health_resolved_{user_id}_{ts}", # ✅ PRIDANÉ ts
            ctx=ctx
        )
        return {"action": "regenerate", "message": "Záznamy sú vyriešené. AI pripravuje návratový plán."}

    max_severity = max(log.get("severity", 0) for log in active_logs)

    if max_severity >= 7:
        service_enqueue_job(
            user_id=user_id,
            job_type="coach_autoadjust",
            payload={"force_reason": "health_critical"},
            priority=100,
            dedupe_key=f"coach_autoadjust_health_critical_{user_id}_{ts}", # ✅ PRIDANÉ ts
            ctx=ctx
        )
        return {
            "action": "suspend", 
            "message": "Nariadené lekárske voľno. Budúce tréningy boli pozastavené."
        }

    else:
        service_enqueue_job(
            user_id=user_id,
            job_type="coach_autoadjust",
            payload={"force_reason": "health_mild_restriction"},
            priority=100,
            dedupe_key=f"coach_autoadjust_health_mild_{user_id}_{ts}", # ✅ PRIDANÉ ts
            ctx=ctx
        )
        return {"action": "autoadjust", "message": "AI zjemňuje najbližšie tréningy podľa tvojho stavu."}
