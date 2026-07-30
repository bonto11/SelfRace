from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

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
    Upsert na (user_id, endpoint). created_at sa neposiela (DB DEFAULT,
    nastavi sa len pri prvom INSERTe).
    Toto je nezavisle od
    last_try_at / last_received_at nizsie, ktore sledujeme na
    server-send resp. SW-ack strane.
    """
    sb = get_sb(ctx, caller="notifications.db_upsert_push_subscription")

    rec = {
        "user_id": user_id,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
    }

    sb.table(TABLE_PUSH_NOTIFICATIONS).upsert(
        rec,
        on_conflict="user_id,endpoint",
    ).execute()

    return rec


def db_mark_push_subscription_try(
    endpoint: str,
    *,
    ctx: AuthCtx,
) -> None:
    """
    Zavola sa VZDY, ked sa server pokusi poslat push na tuto subscription -
    bez ohladu na vysledok (aj 400/401/timeout). Toto je "last_try_at" -
    vstup pre cron cistenie: rozdiel medzi tymto a last_received_at hovori,
    ci to zariadenie realne dostava notifikacie, alebo len akceptuje
    poziadavky bez toho, aby sa co i len pokusilo dorucit (Apple problem).
    """
    sb = get_sb(ctx, caller="notifications.db_mark_push_subscription_try")
    sb.table(TABLE_PUSH_NOTIFICATIONS).update(
        {"last_try_at": datetime.now(timezone.utc).isoformat()}
    ).eq("endpoint", endpoint).execute()


def db_mark_push_subscription_received(
    sub_id: int,
    *,
    ctx: AuthCtx,
) -> None:
    """
    Zavola sa LEN zo Service Workera (push event handler v public/sw.js),
    ked zariadenie REALNE dostane push - jediny nesporny dokaz zivotnosti,
    nezavisly od toho, co hovori push sluzba serveru pri odoslani (Apple
    vie prijat 2xx aj pre uz mrtvu subscription).
    """
    sb = get_sb(ctx, caller="notifications.db_mark_push_subscription_received")
    sb.table(TABLE_PUSH_NOTIFICATIONS).update(
        {"last_received_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", sub_id).execute()


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


def db_get_subscription_by_id(
    sub_id: int,
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Nacita JEDEN konkretny subscription riadok podla id (a user_id, aby si
    nemohol poslat test na cudzi riadok).
    """
    sb = get_sb(ctx, caller="notifications.db_get_subscription_by_id")
    res = (
        sb.table(TABLE_PUSH_NOTIFICATIONS)
        .select("*")
        .eq("id", sub_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = list(res.data or [])
    return rows[0] if rows else None


def db_get_subscriptions_with_try(
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vsetky subscriptions, co uz aspon raz boli skusene poslat
    (last_try_at nie je null) - vstup pre denny cleanup cron.
    Tie, co sa este nikdy neskusali poslat, cron vobec nezaujimaju.
    """
    sb = get_sb(ctx, caller="notifications.db_get_subscriptions_with_try")
    res = (
        sb.table(TABLE_PUSH_NOTIFICATIONS)
        .select("*")
        .not_.is_("last_try_at", "null")
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
