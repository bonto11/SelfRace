from __future__ import annotations

from datetime import datetime, timezone
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
    """
    Upsert na (user_id, endpoint).

    🌟 FIX: created_at sa už NEPOSIELA v payloade — necháva sa na DB
    DEFAULT now(), takže sa nastaví LEN pri prvom INSERTe. Predtým sa
    posielal nanovo pri každom volaní, čím sa pri opakovanom upserte
    (rovnaký endpoint) tichy prepisoval na aktuálny čas — "kedy vznikla"
    tak v skutočnosti znamenalo "kedy sa naposledy upsertlo".

    updated_at sa naopak nastavuje VŽDY — hovorí "kedy klient naposledy
    potvrdil, že toto je jeho aktuálna subscription" (nezamieňať s
    last_success_at nižšie, čo hovorí "kedy sme jej naposledy naozaj
    DORUČILI notifikáciu").
    """
    sb = get_sb(ctx, caller="notifications.db_upsert_push_subscription")

    rec = {
        "user_id": user_id,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    sb.table(TABLE_PUSH_NOTIFICATIONS).upsert(
        rec,
        on_conflict="user_id,endpoint",
    ).execute()

    return rec


def db_mark_push_subscription_success(
    endpoint: str,
    *,
    ctx: AuthCtx,
) -> None:
    """
    Zavolá sa po KAŽDOM úspešnom webpush() doručení (viď
    Services/notifications.py -> service_send_push_notification).
    Toto je jediný spoľahlivý signál "táto subscription reálne žije" —
    created_at/updated_at hovoria len o tom, kedy si klient MYSLEL, že je
    prihlásený, nie či sa to niekam naozaj doručilo.
    """
    sb = get_sb(ctx, caller="notifications.db_mark_push_subscription_success")
    sb.table(TABLE_PUSH_NOTIFICATIONS).update(
        {"last_success_at": datetime.now(timezone.utc).isoformat()}
    ).eq("endpoint", endpoint).execute()


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
