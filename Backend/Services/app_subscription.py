# backend/Services/app_subscription.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date, timedelta

from Routes_DB.app_subscription import (
    db_list_app_subscription_tiers,
    db_get_app_subscription_tier_by_code,
    db_insert_app_user_subscription,
    db_update_app_user_subscription_status,
    db_list_app_user_subscriptions,
    db_get_active_app_subscription_for_user,
    db_get_user_app_subscription_tier,
    db_set_user_app_subscription_tier,
)
from Services.users import require_jwt


def _resolve_jwt(
    user_jwt: Optional[str],
    *,
    service: bool,
) -> Optional[str]:
    """
    Helper – v RLS režime vyžaduje platný JWT, v service režime
    len preposiela (môže byť None).
    """
    if service:
        return user_jwt
    return require_jwt(user_jwt)


# --------- TIERS ---------


def service_list_app_subscription_tiers(
    *,
    include_inactive: bool = False,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    jwt = _resolve_jwt(user_jwt, service=service)

    return db_list_app_subscription_tiers(
        include_inactive=include_inactive,
        user_jwt=jwt,
        service=service,
    )


def service_get_app_subscription_tier_by_code(
    code: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    jwt = _resolve_jwt(user_jwt, service=service)

    return db_get_app_subscription_tier_by_code(
        code,
        user_jwt=jwt,
        service=service,
    )


# --------- USER SUBSCRIPTIONS / STATUS ---------


def service_get_user_app_subscription_status(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Hlavný "status" objekt pre FE:
      - aktuálny tier_code (users.app_subscription_tier alebo 'free'),
      - aktívny subscription z app_user_subscriptions (ak existuje),
      - zoznam dostupných tierov (len active).
    """
    jwt = _resolve_jwt(user_jwt, service=service)

    tier_code = db_get_user_app_subscription_tier(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    active_sub = db_get_active_app_subscription_for_user(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    tiers = db_list_app_subscription_tiers(
        include_inactive=False,
        user_jwt=jwt,
        service=service,
    )

    return {
        "user_id": user_id,
        "tier_code": tier_code,
        "active_subscription": active_sub,
        "tiers": tiers,
    }


def service_list_user_app_subscriptions(
    user_id: int,
    *,
    limit: int = 20,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    História subscriptionov pre usera (napr. do settings → Billing history).
    """
    jwt = _resolve_jwt(user_jwt, service=service)

    return db_list_app_user_subscriptions(
        user_id=user_id,
        limit=limit,
        user_jwt=jwt,
        service=service,
    )


# --------- DEV / MANUAL UPGRADE (bez reálnej platby) ---------


def service_set_user_app_subscription_tier_manual(
    user_id: int,
    tier_code: str,
    *,
    # dev endpoint → typicky service=True (admin/service klient),
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    DEV/ADMIN helper:
      - nastaví users.app_subscription_tier,
      - založí/aktualizuje active subscription v app_user_subscriptions.

    Toto neskôr nahradíš logikou z platobnej brány (webhook).
    """
    jwt = _resolve_jwt(user_jwt, service=service)

    # 1) validácia tieru
    tier = db_get_app_subscription_tier_by_code(
        tier_code,
        user_jwt=jwt,
        service=service,
    )
    if not tier:
        raise ValueError(f"Unknown app_subscription_tier code: {tier_code!r}")

    # 2) zruš existujúci ACTIVE (jednoducho nastav status='cancelled')
    active = db_get_active_app_subscription_for_user(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )
    if active and isinstance(active.get("id"), int):
        db_update_app_user_subscription_status(
            subscription_id=int(active["id"]),
            status="cancelled",
            user_jwt=jwt,
            service=service,
            meta_patch={
                **(active.get("meta") or {}),
                "cancel_reason": "manual_change",
            },
        )

    # 3) založ nový ACTIVE period (jednoducho 30 dní od dnes)
    today = date.today()
    start_iso = today.isoformat()
    end_iso = (today + timedelta(days=30)).isoformat()

    new_sub = db_insert_app_user_subscription(
        user_id=user_id,
        tier_code=tier_code,
        status="active",
        current_period_start=start_iso,
        current_period_end=end_iso,
        cancel_at_period_end=False,
        external_customer_id=None,
        external_subscription_id=None,
        meta={"source": "manual_dev"},
        user_jwt=jwt,
        service=service,
    )

    # 4) users.app_subscription_tier
    user_row = db_set_user_app_subscription_tier(
        user_id=user_id,
        tier_code=tier_code,
        user_jwt=jwt,
        service=service,
    )

    return {
        "user": user_row,
        "active_subscription": new_sub,
        "tier": tier,
    }