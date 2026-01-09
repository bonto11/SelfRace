# Routes_DB/app_subscription.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import (
    TABLE_APP_SUBSCRIPTION_TIERS,
    TABLE_APP_USER_SUBSCRIPTIONS,
    TABLE_USERS,
)

# --------- TIERS (app_subscription_tiers) ---------


def db_list_app_subscription_tiers(
    *,
    include_inactive: bool = False,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> List[Dict[str, Any]]:
    """
    Vráti zoznam app tierov (free / classic / pro ...).
    Typicky service=True (bez RLS), ale môžeš to volať aj cez RLS.
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_subscription_tiers.list",
    )

    query = (
        sb.table(TABLE_APP_SUBSCRIPTION_TIERS)
        .select("*")
        .order("sort_order", ascending=True)
    )

    if not include_inactive:
        query = query.eq("is_active", True)

    res = query.execute()
    return res.data or []


def db_get_app_subscription_tier_by_code(
    code: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Vráti konkrétny tier podľa code (napr. 'free', 'classic', 'pro').
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_subscription_tiers.get_by_code",
    )

    res = (
        sb.table(TABLE_APP_SUBSCRIPTION_TIERS)
        .select("*")
        .eq("code", code)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return res.data


def db_upsert_app_subscription_tier(
    *,
    code: str,
    name: str,
    description: Optional[str],
    monthly_price_cents: int,
    ai_monthly_tokens_limit: int,
    is_active: bool = True,
    sort_order: int = 0,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    Insert / update jedného tieru (podľa code).
    Použiješ skôr v admin nástrojoch.
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_subscription_tiers.upsert",
    )

    payload = {
        "code": code,
        "name": name,
        "description": description,
        "monthly_price_cents": monthly_price_cents,
        "ai_monthly_tokens_limit": ai_monthly_tokens_limit,
        "is_active": is_active,
        "sort_order": sort_order,
    }

    res = (
        sb.table(TABLE_APP_SUBSCRIPTION_TIERS)
        .upsert(payload, on_conflict="code")
        .select("*")           # Pylance tu môže hundrať, runtime v Supabase je OK
        .maybe_single()
        .execute()
    )
    return res.data


# --------- USER SUBSCRIPTIONS (app_user_subscriptions) ---------


def db_insert_app_user_subscription(
    *,
    user_id: int,
    tier_code: str,
    status: str,
    current_period_start: Optional[str],
    current_period_end: Optional[str],
    cancel_at_period_end: bool = False,
    external_customer_id: Optional[str] = None,
    external_subscription_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    Vloží nový záznam do app_user_subscriptions (napr. po webhooku z platobnej brány).
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_user_subscriptions.insert",
    )

    payload = {
        "user_id": user_id,
        "tier_code": tier_code,
        "status": status,
        "current_period_start": current_period_start,
        "current_period_end": current_period_end,
        "cancel_at_period_end": cancel_at_period_end,
        "external_customer_id": external_customer_id,
        "external_subscription_id": external_subscription_id,
        "meta": meta or {},
    }

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .insert(payload)
        .select("*")           # rovnaký pattern ako inde
        .maybe_single()
        .execute()
    )
    return res.data


def db_update_app_user_subscription_status(
    *,
    subscription_id: int,
    status: str,
    current_period_start: Optional[str] = None,
    current_period_end: Optional[str] = None,
    cancel_at_period_end: Optional[bool] = None,
    meta_patch: Optional[Dict[str, Any]] = None,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    Update statusu / period end atď. pre existujúci subscription.
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_user_subscriptions.update_status",
    )

    patch: Dict[str, Any] = {"status": status}
    if current_period_start is not None:
        patch["current_period_start"] = current_period_start
    if current_period_end is not None:
        patch["current_period_end"] = current_period_end
    if cancel_at_period_end is not None:
        patch["cancel_at_period_end"] = cancel_at_period_end
    if meta_patch is not None:
        patch["meta"] = meta_patch

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .update(patch)
        .eq("id", subscription_id)
        .select("*")           # tu prípadne môžeš dať  # type: ignore[attr-defined]
        .maybe_single()
        .execute()
    )
    return res.data


def db_list_app_user_subscriptions(
    user_id: int,
    *,
    limit: int = 20,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> List[Dict[str, Any]]:
    """
    História všetkých subscriptionov usera (napr. pre admin alebo settings UI).
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_user_subscriptions.list_for_user",
    )

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", ascending=False)
        .limit(limit)
        .execute()
    )
    return res.data or []


def db_get_active_app_subscription_for_user(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Vráti posledný ACTIVE subscription pre usera (ak existuje).
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="app_user_subscriptions.get_active_for_user",
    )

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("current_period_end", ascending=False)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return res.data


# --------- users.app_subscription_tier helper ---------


def db_set_user_app_subscription_tier(
    user_id: int,
    tier_code: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    Nastaví users.app_subscription_tier (rýchly flag pre FE / billing).
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="users.set_app_subscription_tier",
    )

    res = (
        sb.table(TABLE_USERS)
        .update({"app_subscription_tier": tier_code})
        .eq("id", user_id)
        .select("id, app_subscription_tier")
        .maybe_single()
        .execute()
    )
    return res.data


def db_get_user_app_subscription_tier(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> str:
    """
    Vráti users.app_subscription_tier (alebo 'free' ak je NULL).
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="users.get_app_subscription_tier",
    )

    res = (
        sb.table(TABLE_USERS)
        .select("app_subscription_tier")
        .eq("id", user_id)
        .limit(1)
        .maybe_single()
        .execute()
    )
    row = res.data or {}
    tier = row.get("app_subscription_tier") or "free"
    return str(tier)