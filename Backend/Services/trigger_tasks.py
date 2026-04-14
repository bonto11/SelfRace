from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Any, Dict, List

from Modules.Supabase.auth import AuthCtx

# Importy cron služieb (Notifikácie a AI)
from Services.notifications import (
    service_cron_notify_recovery,
    service_cron_notify_review,
    service_cron_notify_training,
    service_cron_notify_check_ai,
)
from Services.AI.athlete_state.main import service_run_weekly_athlete_state
from DB.users import (
    db_force_logout_all_users
)

from Services.maintenance import (
    service_cleanup_deleted_activities,
    service_account_hard_delete,
    service_cleanup_expired_activity_details,
)
from Services.coach_plan_active import service_complete_due_active_plans
from Services.app_subscription import service_apply_due_subscription_changes

# =========================================================================
# HLAVNÝ MASTER SCHEDULER
# =========================================================================

def service_run_master_scheduler(
    ctx: AuthCtx, 
    mode: str = "scheduled", 
    task: str | None = None
) -> Dict[str, Any]:
    """
    Hlavná riadiaca logika Schedulera.
    Zlučuje manuálne spustenie konkrétnej úlohy a automatické spustenie podľa času.
    """
    
    # -------------------------------------------------------------------------
    # A) MANUÁLNY REŽIM (Z ADMIN PANELA)
    # -------------------------------------------------------------------------
    if mode == "manual":
        if not task:
            raise ValueError("Pre manuálny režim musí byť zadaný 'task'.")
            
        print(f"[ADMIN TRIGGER] Manuálne spustenie úlohy: {task}")
        
        # Databáza & Údržba
        if task == "cleanup-deleted-activities":
            service_cleanup_deleted_activities(ctx=ctx, cutoff_days=30)
            service_cleanup_expired_activity_details(ctx=ctx)
        elif task == "app-subscriptions-apply":
            service_apply_due_subscription_changes(ctx=ctx)
        elif task == "account-hard-delete":
            service_account_hard_delete(ctx=ctx, dry_run=False, only_user_id=None)
        elif task == "coach-plan-complete":
            service_complete_due_active_plans(ctx=ctx)
        elif task == "force-logout-all":
            result = db_force_logout_all_users(ctx=ctx)
            
        # Notifikácie & AI
        elif task == "check-ai-models":
            service_cron_notify_check_ai(admin_email="patrikmbontar@gmail.com", ctx=ctx)
        elif task == "notify-review":
            service_cron_notify_review(ctx=ctx)
        elif task == "notify-recovery":
            service_cron_notify_recovery(ctx=ctx)
        elif task == "notify-training":
            service_cron_notify_training(ctx=ctx)
        elif task == "weekly-athlete-state":
            service_run_weekly_athlete_state(max_users=0, ctx=ctx)
        else:
            raise ValueError(f"Neznáma úloha: {task}")

        return {
            "status": "executed_manual",
            "task": task,
            "message": f"Úloha '{task}' bola úspešne vykonaná."
        }


    # -------------------------------------------------------------------------
    # B) ČASOVANÝ REŽIM (GOOGLE SCHEDULER)
    # -------------------------------------------------------------------------
    tz_ba = ZoneInfo("Europe/Bratislava")
    now_ba = datetime.now(tz_ba)
    current_hour = now_ba.hour
    current_weekday = now_ba.weekday()  # 0=Pondelok, 6=Nedeľa

    print(f"--- [SCHEDULER PING] {now_ba.strftime('%Y-%m-%d %H:%M:%S')} ---")

    # -------------------------------------------------------------------------
    # 1. NOČNÁ ÚDRŽBA DATABÁZY
    # -------------------------------------------------------------------------
    if current_hour == 1:  # Nastavené na 1 podľa tvojho kódu
        print("[SCHEDULER] 🧹 Je 01:00. Spúšťam údržbu (Maintenance).")
        
        try:
            service_cleanup_deleted_activities(ctx=ctx, cutoff_days=30)
            print("[SCHEDULER] ✅ Údržba: 'cleanup_deleted_activities' hotovo.")
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba 'cleanup_deleted_activities': {e}")

        try:
            service_cleanup_expired_activity_details(ctx=ctx)
            print("[SCHEDULER] ✅ Údržba: 'cleanup_expired_activity_details' hotovo.")
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba 'cleanup_expired_activity_details': {e}")

        try:
            service_apply_due_subscription_changes(ctx=ctx)
            print("[SCHEDULER] ✅ Údržba: 'apply_due_subscription_changes' hotovo.")
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba 'apply_due_subscription_changes': {e}")

        try:
            service_account_hard_delete(ctx=ctx, dry_run=False, only_user_id=None)
            print("[SCHEDULER] ✅ Údržba: 'account_hard_delete' hotovo.")
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba 'account_hard_delete': {e}")

        try:
            service_complete_due_active_plans(ctx=ctx)
            print("[SCHEDULER] ✅ Údržba: 'coach_plan_complete_due' hotovo.")
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba 'coach_plan_complete_due': {e}")

    # -------------------------------------------------------------------------
    # 2. KAŽDOHODINOVÁ LOGIKA
    # -------------------------------------------------------------------------
    print(f"[SCHEDULER] Hodinová kontrola spustená (Hour: {current_hour})")
    
    try:
        service_cron_notify_check_ai(admin_email="patrikmbontar@gmail.com", ctx=ctx)
        print("[SCHEDULER] ✅ Kontrola AI modelov prebehla úspešne.")
    except Exception as e:
        print(f"[SCHEDULER] ❌ Chyba pri kontrole AI modelov: {e}")

    try:
        service_cron_notify_review(ctx=ctx)
        print("[SCHEDULER] ✅ Pripomienka 'review' skontrolovaná.")
    except Exception as e:
        print(f"[SCHEDULER] ❌ Chyba Review notifikácií: {e}")

    # -------------------------------------------------------------------------
    # 3. DENNÉ NOTIFIKÁCIE
    # -------------------------------------------------------------------------
    if current_hour == 11:
        print("[SCHEDULER] ☀️ Je 11:00. Posielam Recovery notifikácie...")
        try:
            service_cron_notify_recovery(ctx=ctx)
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba Recovery notifikácií: {e}")

    if current_hour == 19:
        print("[SCHEDULER] 🌙 Je 19:00. Posielam Training notifikácie...")
        try:
            service_cron_notify_training(ctx=ctx)
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba Training notifikácií: {e}")

    # -------------------------------------------------------------------------
    # 4. TÝŽDENNÁ LOGIKA
    # -------------------------------------------------------------------------
    if current_weekday == 6 and current_hour == 23:
        print("[SCHEDULER] 📅 Je Nedeľa 23:00. Spúšťam týždennú údržbu.")
        
        try:
            print("[SCHEDULER] Spúšťam 'weekly_athlete_state_refresh'...")
            service_run_weekly_athlete_state(max_users=0, ctx=ctx)
            print("[SCHEDULER] ✅ Analýza atlétov úspešná.")
        except Exception as e:
            print(f"[SCHEDULER] ❌ Chyba pri weekly_athlete_state: {e}")

    # Vrátime výsledok pre logy
    return {
        "status": "executed_scheduled",
        "hour": current_hour,
        "weekday": current_weekday,
        "timestamp_ba": now_ba.isoformat()
    }