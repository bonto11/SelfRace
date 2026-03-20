# Services/users_health_log.py
from __future__ import annotations
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
    """
    Vymaže záznam (napríklad pridaný omylom).
    """
    return db_delete_health_log(log_id=log_id, user_id=user_id, ctx=ctx)


def service_adapt_plan_for_health(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Rozhodne o osude plánu na základe aktuálnych aktívnych chorôb a zranení.
    """
    active_logs = db_get_active_health_logs(user_id=user_id, ctx=ctx)
    today_iso = datetime.now(timezone.utc).date().isoformat()

    # SCENÁR 1: Všetko vyriešené (0 aktívnych problémov)
    if not active_logs:
        service_enqueue_job(
            user_id=user_id,
            job_type="weekly_generate",
            payload={"overwrite": True, "reason": "health_resolved_return"},
            priority=90,
            dedupe_key=f"weekly_gen_health_resolved_{user_id}",
            ctx=ctx
        )
        return {"action": "regenerate", "message": "Záznamy sú vyriešené. AI pripravuje návratový plán."}

    # Nájdi najhorší aktuálny problém
    max_severity = max(log.get("severity", 0) for log in active_logs)

    # SCENÁR 2: Kritický stav (Vážnosť 7 - 10)
    if max_severity >= 7:
        # Lekárske voľno -> Vymazať budúcnosť
        db_delete_future_daily_plans(user_id=user_id, from_date=today_iso, ctx=ctx)
        db_delete_future_weekly_plans(user_id=user_id, from_date_iso=today_iso, ctx=ctx)
        
        return {
            "action": "cleared", 
            "message": "Nariadené lekárske voľno. Budúce tréningy a týždne boli zmazané, oddychuj."
        }

    # SCENÁR 3: Mierny stav (Vážnosť 1 - 6)
    else:
        # Zistíme, či kalendár nebol predtým vymazaný (napr. prechod z ťažkej choroby na ľahkú)
        has_weekly = db_check_weekly_data_exists(user_id=user_id, ctx=ctx)
        
        if not has_weekly:
            # Plán bol zmazaný, užívateľ sa zotavuje.
            # Musíme VYGENEROVAŤ nový plán s pokynom na extra 1-2 dni voľna a ľahký štart.
            service_enqueue_job(
                user_id=user_id,
                job_type="weekly_generate",
                payload={"overwrite": True, "reason": "health_recovery_mild"},
                priority=90,
                dedupe_key=f"weekly_gen_health_rec_{user_id}",
                ctx=ctx
            )
            return {"action": "regenerate", "message": "Zlepšenie stavu! AI pripravuje pozvoľný návrat (s extra dňami na doliečenie)."}
        
        else:
            # Plán existuje (nový soplík počas inak zdravého tréningu) -> Iba zjemníme aktuálny plán
            service_enqueue_job(
                user_id=user_id,
                job_type="coach_autoadjust",
                payload={"force_reason": "health_mild_restriction"},
                priority=100,
                dedupe_key=f"daily_autoadjust_health_{user_id}",
                ctx=ctx
            )
            return {"action": "autoadjust", "message": "AI zjemňuje najbližšie tréningy podľa tvojho stavu."}