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


# --- 2. SKELETONY PRE CRONY A EVENTY ---

def service_notify_test(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z FE tlačidla 'Test'."""
    return service_send_push_notification(
        user_id=user_id,
        title="Test Notifikácie",
        body="Všetko funguje! PWA je pripravená a smeruje ťa na domovskú obrazovku.",
        url="/",
        ctx=ctx
    )

def service_notify_recovery_reminder(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 11:00."""
    # TODO: Logika pre check DB, či user už zadal dnešné recovery
    return service_send_push_notification(
        user_id=user_id,
        title="Nezabudni na Ranné Recovery",
        body="Zadaj svoje pocity a tep, nech presne vieme, ako si na tom.",
        url="/recovery/recoveryInputs",
        ctx=ctx
    )

def service_notify_activity_review(user_id: int, activity_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z hodinového cronu (1 hodinu po aktivite)."""
    # TODO: Logika pre check DB, či aktivita už má review
    return service_send_push_notification(
        user_id=user_id,
        title="Ako sa ti dnes išlo?",
        body="Ohodnoť svoj posledný tréning a zadaj náročnosť (RPE).",
        url=f"/activities/{activity_id}",  # Nasmerujeme priamo na detail aktivity
        ctx=ctx
    )

def service_notify_athlete_state_progress(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z víkendového cronu po prepočte."""
    # TODO: Logika pre check DB
    return service_send_push_notification(
        user_id=user_id,
        title="Nová Analýza Výkonnosti",
        body="Tvoj Athlete State je aktualizovaný. Pozri si svoj progres!",
        url="/progress",
        ctx=ctx
    )

def service_notify_training_reminder(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 19:00."""
    # TODO: Logika pre check DB, či je plán splnený
    return service_send_push_notification(
        user_id=user_id,
        title="Dnes ťa ešte čaká tréning",
        body="Tvoj plán na dnes ešte nie je splnený. Stíhaš to?",
        url="/calendar",
        ctx=ctx
    )
