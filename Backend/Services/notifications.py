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


def service_send_push_notification(
    user_id: int,
    title: str,
    body: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Nájde všetky zariadenia používateľa a pošle im push notifikáciu.
    """
    subs = db_get_user_subscriptions(user_id=user_id, ctx=ctx)
    if not subs:
        return {"success": False, "message": "User has no active subscriptions."}

    payload = json.dumps({
        "title": title,
        "body": body,
        # Ak chceš presmerovať po kliknutí na konkrétnu url, zmeň toto:
        "url": "/", 
        "icon": "/icon.png"
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
            # Ak vráti 410 (Gone), znamená to, že user notifikácie zakázal alebo zmazal browser
            if ex.response is not None and ex.response.status_code == 410:
                db_delete_push_subscription(endpoint=sub["endpoint"], ctx=ctx)
            else:
                print(f"[Push Error] Nepodarilo sa odoslať na endpoint: {repr(ex)}")
            error_count += 1

    return {"success": True, "sent": success_count, "failed": error_count}