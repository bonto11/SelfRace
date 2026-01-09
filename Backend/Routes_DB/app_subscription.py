# Routes_DB/app_subscription.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_APP_USER_SUBSCRIPTIONS, TABLE_USERS

# --------- TIERY (app_subscription_tiers) ---------


def db_list_app_subscription_tiers(
    *,
    include_inactive: bool = False,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> List[Dict[str, Any]]:
    
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="app_user_subscriptions")
    query = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
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
    client = _get_client(user_jwt, service)
    res = (
        client.table(TABLE_APP_USER_SUBSCRIPTIONS)
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
    client = _get_client(user_jwt, service)

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
        client.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .upsert(payload, on_conflict="code")
        .select("*")
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
    client = _get_client(user_jwt, service)

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
        client.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .insert(payload)
        .select("*")
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
    client = _get_client(user_jwt, service)

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
        client.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .update(patch)
        .eq("id", subscription_id)
        .select("*")
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
    client = _get_client(user_jwt, service)
    res = (
        client.table(TABLE_APP_USER_SUBSCRIPTIONS)
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
    client = _get_client(user_jwt, service)
    res = (
        client.table(TABLE_APP_USER_SUBSCRIPTIONS)
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
    client = _get_client(user_jwt, service)
    res = (
        client.table("users")
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
    client = _get_client(user_jwt, service)
    res = (
        client.table("users")
        .select("app_subscription_tier")
        .eq("id", user_id)
        .limit(1)
        .maybe_single()
        .execute()
    )
    row = res.data or {}
    tier = row.get("app_subscription_tier") or "free"
    return str(tier)