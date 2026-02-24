from __future__ import annotations

import json
from typing import Any, Dict
from datetime import datetime, timezone

from pywebpush import webpush, WebPushException
from Routes_DB.notifications import (
    db_upsert_push_subscription, 
    db_get_user_subscriptions, 
    db_delete_push_subscription
)
from Modules.Supabase.auth import AuthCtx

from Routes_DB.activities_enrichment import db_get_unreviewed_activities_for_push
from Routes_DB.user_recovery import db_get_recovery_record
from Routes_DB.coach_plan_daily import db_has_uncompleted_daily_sessions

# ✅ PRIDANÝ IMPORT PRE ZOZNAM POUŽÍVATEĽOV
from Routes_DB.users import db_list_users_for_cron

from Configs.config import VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL

def service_save_push_subscription(
    user_id: int,
    subscription_data: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    endpoint = subscription_data.get("endpoint")
    keys = subscription_data.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        raise ValueError("Neplatný formát push subscription objektu.")

    return db_upsert_push_subscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        ctx=ctx
    )

# --- 1. UNIVERZÁLNY ODOSIELATEĽ ---

def service_send_push_notification(
    user_id: int,
    title: str,
    body: str,
    url: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Nájde všetky zariadenia používateľa a pošle im push notifikáciu s dynamickou URL.
    """
    subs = db_get_user_subscriptions(user_id=user_id, ctx=ctx)
    if not subs:
        return {"success": False, "message": "User has no active subscriptions."}

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": "/logo/selfrace_logo_nocolor_230.png"
    })

    success_count = 0
    error_count = 0

    for sub in subs:
        sub_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "p256dh": sub["p256dh"],
                "auth": sub["auth"]
            }
        }
        
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIM_EMAIL}
            )
            success_count += 1
        except WebPushException as ex:
            if ex.response is not None and ex.response.status_code == 410:
                db_delete_push_subscription(endpoint=sub["endpoint"], ctx=ctx)
            else:
                print(f"[Push Error] Nepodarilo sa odoslať na endpoint: {repr(ex)}")
            error_count += 1

    return {"success": True, "sent": success_count, "failed": error_count}


# --- SKELETONY PRE CRONY (PRODUKČNÉ VERZIE) ---

def service_cron_notify_recovery(ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 11:00. Skontroluje všetkých userov."""
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    users = db_list_users_for_cron(ctx=ctx)
    
    total_sent = 0
    
    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
            
        existing_record = db_get_recovery_record(
            user_id=user_id,
            date_iso=today_iso,
            ctx=ctx
        )
        
        # Ak záznam neexistuje, posielame notifikáciu
        if not existing_record:
            res = service_send_push_notification(
                user_id=user_id,
                title="Nezabudni na Ranné Recovery 🔋",
                body="Zadaj info o spánku a HR nech presne vieme, ako si na tom.",
                url="/recovery",
                ctx=ctx
            )
            total_sent += res.get("sent", 0)
            
    return {"success": True, "sent": total_sent, "message": f"Skontrolovaných {len(users)} užívateľov."}


def service_cron_notify_review(ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z hodinového cronu. Skontroluje všetkých userov."""
    users = db_list_users_for_cron(ctx=ctx)
    total_sent = 0
    
    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
            
        pending_activities = db_get_unreviewed_activities_for_push(user_id=user_id, ctx=ctx)
        
        if not pending_activities:
            continue
            
        # Zoradíme podľa updated_at a zoberieme poslednú
        pending_activities.sort(key=lambda x: x.get("updated_at", ""))
        latest_activity = pending_activities[-1]
        
        activity_id = latest_activity["activity_id"]

        res = service_send_push_notification(
            user_id=user_id,
            title="Ako sa ti dnes išlo? 🏃",
            body="Ohodnoť svoj posledný tréning.",
            url="/calendar", 
            ctx=ctx
        )
        total_sent += res.get("sent", 0)

    return {"success": True, "sent": total_sent, "message": f"Skontrolovaných {len(users)} užívateľov."}


def service_cron_notify_training(ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 19:00. Skontroluje všetkých userov."""
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    users = db_list_users_for_cron(ctx=ctx)
    
    total_sent = 0
    
    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
            
        has_uncompleted = db_has_uncompleted_daily_sessions(
            user_id=user_id,
            plan_date=today_iso,
            ctx=ctx
        )
        
        # Ak má neukončené tréningy, posielame postrčenie
        if has_uncompleted:
            res = service_send_push_notification(
                user_id=user_id,
                title="Dnes ťa ešte čaká tréning! 👟",
                body="Tvoj plán na dnes ešte nie je splnený. Stíhaš to?",
                url="/coach/ai/dailyPlan",
                ctx=ctx
            )
            total_sent += res.get("sent", 0)
            
    return {"success": True, "sent": total_sent, "message": f"Skontrolovaných {len(users)} užívateľov."}
    
    
# --- EVENT NOTIFIKÁCIE (Udalosti) ---
    
def service_notify_athlete_state_progress(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané priamo z AI service po prepočte nového Athlete State."""
    return service_send_push_notification(
        user_id=user_id,
        title="Nová Analýza Výkonnosti 📈",
        body="Tvoj Athlete State bol práve aktualizovaný. Pozri si svoj progres!",
        url="/coach/ai/progress",
        ctx=ctx
    )

def service_notify_test(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z FE tlačidla 'Test'."""
    return service_send_push_notification(
        user_id=user_id,
        title="Test Notifikácie 🚀",
        body="Všetko funguje! PWA je pripravená a smeruje ťa na domovskú obrazovku.",
        url="/activities",
        ctx=ctx
    )