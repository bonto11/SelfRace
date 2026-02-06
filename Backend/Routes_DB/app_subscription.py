# Routes_DB/app_subscription.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import (
    TABLE_APP_SUBSCRIPTION_TIERS,
    TABLE_APP_USER_SUBSCRIPTIONS,
    TABLE_USERS,
)

# --------- TIERS (app_subscription_tiers) ---------


def db_list_app_subscription_tiers(
    *,
    include_inactive: bool = False,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Zoznam app tierov (free / classic / pro ...).
    """
    sb = get_sb(ctx, caller="app_subscription.db_list_app_subscription_tiers")

    res = (
        sb.table(TABLE_APP_SUBSCRIPTION_TIERS)
        .select("*")
        .order("sort_order", desc=False)  # vzostupne
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    if not include_inactive:
        rows = [r for r in rows if r.get("is_active")]
    return rows


def db_get_app_subscription_tier_by_code(
    code: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Konkrétny tier podľa code (napr. 'free', 'classic', 'pro').
    """
    sb = get_sb(ctx, caller="app_subscription.db_get_app_subscription_tier_by_code")

    res = (
        sb.table(TABLE_APP_SUBSCRIPTION_TIERS)
        .select("*")
        .eq("code", code)
        .limit(1)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else None


def db_upsert_app_subscription_tier(
    *,
    code: str,
    name: str,
    description: Optional[str],
    monthly_price_cents: int,
    ai_monthly_tokens_limit: int,
    is_active: bool = True,
    sort_order: int = 0,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Insert / update jedného tieru (podľa code).
    """
    sb = get_sb(ctx, caller="app_subscription.db_upsert_app_subscription_tier")

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
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else payload


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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vloží nový záznam do app_user_subscriptions (napr. po webhooku z platobnej brány).
    """
    sb = get_sb(ctx, caller="app_subscription.db_insert_app_user_subscription")

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

    res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).insert(payload).execute()

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else payload


def db_update_app_user_subscription_status(
    *,
    subscription_id: int,
    status: str,
    current_period_start: Optional[str] = None,
    current_period_end: Optional[str] = None,
    cancel_at_period_end: Optional[bool] = None,
    meta_patch: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Update statusu / period end atď. pre existujúci subscription.
    """
    sb = get_sb(ctx, caller="app_subscription.db_update_app_user_subscription_status")

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
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else patch


def db_list_app_user_subscriptions(
    user_id: int,
    *,
    limit: int = 20,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    História všetkých subscriptionov usera (napr. pre admin alebo settings UI).
    """
    sb = get_sb(ctx, caller="app_subscription.db_list_app_user_subscriptions")

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)  # najnovšie hore
        .limit(limit)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows


def db_get_active_app_subscription_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti posledný ACTIVE subscription pre usera (ak existuje).
    """
    sb = get_sb(ctx, caller="app_subscription.db_get_active_app_subscription_for_user")

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("current_period_end", desc=True)  # najneskorší koniec
        .limit(1)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else None


# --------- users.app_subscription_tier helper ---------


def db_set_user_app_subscription_tier(
    user_id: int,
    tier_code: str,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Nastaví users.app_subscription_tier (rýchly flag pre FE / billing).
    """
    sb = get_sb(ctx, caller="app_subscription.db_set_user_app_subscription_tier")

    res = (
        sb.table(TABLE_USERS)
        .update({"app_subscription_tier": tier_code})
        .eq("id", user_id)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    # typicky 1 riadok, ale fallback na to, čo sme poslali
    return rows[0] if rows else {"id": user_id, "app_subscription_tier": tier_code}


def db_get_user_app_subscription_tier(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> str:
    """
    Vráti users.app_subscription_tier (alebo 'free' ak je NULL).
    """
    sb = get_sb(ctx, caller="app_subscription.db_get_user_app_subscription_tier")

    res = (
        sb.table(TABLE_USERS)
        .select("app_subscription_tier")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    row = rows[0] if rows else {}
    tier = row.get("app_subscription_tier") or "free"
    return str(tier)


def db_list_due_subscription_changes(
    *,
    now_iso: str,
    ctx: AuthCtx,
    limit: int = 1000,
) -> List[Dict[str, Any]]:
    """
    ACTIVE subscriptions s cancel_at_period_end = true
    a current_period_end <= now_iso.
    """
    sb = get_sb(ctx, caller="app_subscription.db_list_due_subscription_changes")

    res = (
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS)
        .select("*")
        .eq("status", "active")
        .eq("cancel_at_period_end", True)
        .lte("current_period_end", now_iso)
        .limit(limit)
        .execute()
    )

    return res.data or []
