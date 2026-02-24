# Services/notifications.py
from __future__ import annotations

from typing import Any, Dict

from Routes_DB.notifications import db_upsert_push_subscription
from Modules.Supabase.auth import AuthCtx

def service_save_push_subscription(
    user_id: int,
    subscription_data: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Spracuje JSON objekt zo service workera a uloží kľúče do DB.
    """
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