from __future__ import annotations

import json
from typing import Any, Dict

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

# --- SKELETONY PRE CRONY ---

def service_cron_notify_recovery(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 11:00."""
    
    # 1. Získame dnešný dátum vo formáte YYYY-MM-DD (podľa UTC)
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # 2. Pozrieme sa do DB, či pre dnešok už existuje záznam
    existing_record = db_get_recovery_record(
        user_id=user_id,
        date_iso=today_iso,
        ctx=ctx
    )
    
    if existing_record:
        # Užívateľ si už recovery vyplnil, neotravujeme ho
        return {"success": True, "sent": 0, "message": f"Recovery pre {today_iso} už bolo vyplnené."}
    
    # 3. Ak neexistuje, pošleme notifikáciu
    return service_send_push_notification(
        user_id=user_id,
        title="Nezabudni na Ranné Recovery 🔋",
        body="Zadaj svoje pocity a tep, nech presne vieme, ako si na tom.",
        url="/recovery/recoveryInputs",
        ctx=ctx
    )


def service_cron_notify_review(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z hodinového cronu."""
    
    # 1. Vytiahneme aktivity v správnom časovom okne
    pending_activities = db_get_unreviewed_activities_for_push(user_id=user_id, ctx=ctx)
    
    if not pending_activities:
        return {"success": True, "sent": 0, "message": "Ziadne cerstve aktivity bez review."}
    
    # 2. Ak ich je viac (napr. mal 2 tréningy rýchlo po sebe), vezmeme tú najnovšiu
    # Zoradíme podľa updated_at a zoberieme poslednú
    pending_activities.sort(key=lambda x: x.get("updated_at", ""))
    latest_activity = pending_activities[-1]
    
    activity_id = latest_activity["activity_id"]

    # 3. Odošleme Push
    return service_send_push_notification(
        user_id=user_id,
        title="Ako sa ti dnes išlo? 🏃",
        body="Ohodnoť svoj posledný tréning a zadaj náročnosť (RPE).",
        url=f"/activities/{activity_id}", 
        ctx=ctx
    )


def service_cron_notify_training(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 19:00."""
    
    # 1. Zistíme dnešný dátum
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # 2. Skontrolujeme DB, či mu na dnes nezostal nejaký neukončený tréning
    has_uncompleted = db_has_uncompleted_daily_sessions(
        user_id=user_id,
        plan_date=today_iso,
        ctx=ctx
    )
    
    # Ak nemá neukončené tréningy (všetko odbehol, alebo mal rest day), potichu skončíme
    if not has_uncompleted:
        return {"success": True, "sent": 0, "message": "Plán na dnes je splnený (alebo voľný deň)."}
    
    # 3. Ak mu ešte niečo zostalo, pošleme mu Push postrčenie
    return service_send_push_notification(
        user_id=user_id,
        title="Dnes ťa ešte čaká tréning! 👟",
        body="Tvoj plán na dnes ešte nie je splnený. Stíhaš to?",
        url="/calendar",
        ctx=ctx
    )

