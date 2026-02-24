# Routes_DB/notifications.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

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
    
    # Použijeme on_conflict="user_id,endpoint" na aktualizáciu existujúceho zariadenia
    sb.table(TABLE_PUSH_NOTIFICATIONS).upsert(
        rec,
        on_conflict="user_id,endpoint",
    ).execute()

    return rec