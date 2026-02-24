from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_PUSH_NOTIFICATIONS

def db_upsert_push_subscription(
    user_id: int,
    endpoint: str,
    p256dh: str,
    auth: str,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="notifications.db_upsert_push_subscription")

    rec = {
        "user_id": user_id,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    sb.table(TABLE_PUSH_NOTIFICATIONS).upsert(
        rec,
        on_conflict="user_id,endpoint",
    ).execute()

    return rec


def db_get_user_subscriptions(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="notifications.db_get_user_subscriptions")
    res = (
        sb.table(TABLE_PUSH_NOTIFICATIONS)
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return list(res.data or [])


def db_delete_push_subscription(
    endpoint: str,
    *,
    ctx: AuthCtx,
) -> None:
    sb = get_sb(ctx, caller="notifications.db_delete_push_subscription")
    sb.table(TABLE_PUSH_NOTIFICATIONS).delete().eq("endpoint", endpoint).execute()