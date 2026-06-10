# Services/scheduler.py — aktualizovaná verzia
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Any, Dict

from Modules.Supabase.auth import AuthCtx

from Services.notifications import (
    service_cron_notify_recovery,
    service_cron_notify_review,
    service_cron_notify_training,
    service_cron_notify_check_ai,
    service_cron_notify_monthly_summary,
)
from Services.AI.athlete_state.main import service_run_weekly_athlete_state
from DB.users import db_force_logout_all_users

from Services.maintenance import (
    service_cleanup_deleted_activities,
    service_account_hard_delete,
    service_cleanup_expired_activity_details,
)
from Services.coach_plan_active import service_complete_due_active_plans
from Services.app_subscription import service_apply_due_subscription_changes


def service_run_master_scheduler(
    ctx: AuthCtx,
    mode: str = "scheduled",
    task: str | None = None,
) -> Dict[str, Any]:

    # -------------------------------------------------------------------------
    # A) MANUÁLNY REŽIM
    # -------------------------------------------------------------------------
    if mode == "manual":
        if not task:
            raise ValueError("Pre manuálny režim musí byť zadaný 'task'.")

        print(f"[ADMIN TRIGGER] Manuálne spustenie: {task}")

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
            db_force_logout_all_users(ctx=ctx)
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
        elif task == "monthly-summary":
            service_cron_notify_monthly_summary(ctx=ctx)
        else:
            raise ValueError(f"Neznáma úloha: {task}")

        return {"status": "executed_manual", "task": task}

    # -------------------------------------------------------------------------
    # B) ČASOVANÝ REŽIM
    # -------------------------------------------------------------------------
    tz_ba = ZoneInfo("Europe/Bratislava")
    now_ba = datetime.now(tz_ba)
    hour    = now_ba.hour
    weekday = now_ba.weekday()
    day     = now_ba.day

    print(f"[SCHEDULER] {now_ba.strftime('%Y-%m-%d %H:%M:%S')}")

    # 1. NOČNÁ ÚDRŽBA (01:00)
    if hour == 1:
        for fn, name in [
            (lambda: service_cleanup_deleted_activities(ctx=ctx, cutoff_days=30),    "cleanup_deleted"),
            (lambda: service_cleanup_expired_activity_details(ctx=ctx),              "cleanup_details"),
            (lambda: service_apply_due_subscription_changes(ctx=ctx),                "subscriptions"),
            (lambda: service_account_hard_delete(ctx=ctx, dry_run=False),            "hard_delete"),
            (lambda: service_complete_due_active_plans(ctx=ctx),                     "plan_complete"),
        ]:
            try:
                fn()
            except Exception as e:
                print(f"[SCHEDULER] ❌ {name}: {e}")

    # 2. KAŽDOHODINOVÁ KONTROLA
    try:
        service_cron_notify_check_ai(admin_email="patrikmbontar@gmail.com", ctx=ctx)
    except Exception as e:
        print(f"[SCHEDULER] ❌ check-ai: {e}")

    try:
        service_cron_notify_review(ctx=ctx)
    except Exception as e:
        print(f"[SCHEDULER] ❌ notify-review: {e}")

    # 3. DENNÉ NOTIFIKÁCIE
    if hour == 11:
        try:
            service_cron_notify_recovery(ctx=ctx)
        except Exception as e:
            print(f"[SCHEDULER] ❌ notify-recovery: {e}")

    if hour == 19:
        try:
            service_cron_notify_training(ctx=ctx)
        except Exception as e:
            print(f"[SCHEDULER] ❌ notify-training: {e}")

    # 4. MESAČNÝ SÚHRN — 1. deň v mesiaci o 09:00
    if day == 1 and hour == 9:
        print("[SCHEDULER] 📊 1. deň v mesiaci 09:00 — spúšťam mesačný súhrn.")
        try:
            service_cron_notify_monthly_summary(ctx=ctx)
        except Exception as e:
            print(f"[SCHEDULER] ❌ monthly-summary: {e}")

    # 5. TÝŽDENNÁ LOGIKA (Nedeľa 23:00)
    if weekday == 6 and hour == 23:
        try:
            service_run_weekly_athlete_state(max_users=0, ctx=ctx)
        except Exception as e:
            print(f"[SCHEDULER] ❌ weekly-athlete-state: {e}")

    return {
        "status": "executed_scheduled",
        "hour": hour,
        "weekday": weekday,
        "day": day,
        "timestamp_ba": now_ba.isoformat(),
    }