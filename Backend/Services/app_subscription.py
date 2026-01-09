# Services/app_subscription.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Routes_DB.app_subscription import (
    db_list_app_subscription_tiers,
    db_get_app_subscription_tier_by_code,
    db_insert_app_user_subscription,
    db_update_app_user_subscription_status,
    db_list_app_user_subscriptions,
    db_get_active_app_subscription_for_user,
    db_set_user_app_subscription_tier,
    db_get_user_app_subscription_tier,
)

# ---------- TIERS ----------


def service_list_app_subscription_tiers(
    *,
    include_inactive: bool = False,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Zoznam tierov pre FE / admin.
    Default: RLS (service=False, user_jwt z FE).
    """
    return db_list_app_subscription_tiers(
        include_inactive=include_inactive,
        user_jwt=user_jwt,
        service=service,
    )


# ---------- STATUS / HISTORY ----------


def service_get_user_app_subscription_status(
    *,
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vráti:
      - aktuálny tier flag z users.app_subscription_tier (alebo 'free')
      - aktívny subscription z app_user_subscriptions (ak existuje)
      - zoznam tierov (len aktívne)
    """
    tier_code = db_get_user_app_subscription_tier(
        user_id=user_id,
        user_jwt=user_jwt,
        service=service,
    )

    active_sub = db_get_active_app_subscription_for_user(
        user_id=user_id,
        user_jwt=user_jwt,
        service=service,
    )

    tiers = db_list_app_subscription_tiers(
        include_inactive=False,
        user_jwt=user_jwt,
        service=service,
    )

    return {
        "user_id": user_id,
        "tier_code": tier_code,
        "active_subscription": active_sub,
        "tiers": tiers,
    }


def service_list_user_app_subscriptions(
    *,
    user_id: int,
    limit: int = 20,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    História subscriptionov pre usera.
    """
    return db_list_app_user_subscriptions(
        user_id=user_id,
        limit=limit,
        user_jwt=user_jwt,
        service=service,
    )


# ---------- DEV: manuálne prepnutie tieru ----------


def service_set_user_app_subscription_tier_manual(
    *,
    user_id: int,
    tier_code: str,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    DEV/ADMIN helper – manuálne prepne tier usera (bez reálnej platby).

    Robí:
      1) validuje, že tier_code existuje v app_subscription_tiers
      2) zruší aktuálny active subscription (ak je)
      3) založí nový active subscription
      4) nastaví users.app_subscription_tier = tier_code
    """
    # 1) validácia tieru
    tier = db_get_app_subscription_tier_by_code(
        code=tier_code,
        user_jwt=user_jwt,
        service=service,
    )
    if not tier:
        raise ValueError(f"Unknown subscription tier: {tier_code!r}")

    # 2) zruš existujúci active subscription (ak je)
    active = db_get_active_app_subscription_for_user(
        user_id=user_id,
        user_jwt=user_jwt,
        service=service,
    )

    now = datetime.now(timezone.utc).isoformat()

    if active and active.get("id"):
        db_update_app_user_subscription_status(
            subscription_id=int(active["id"]),
            status="cancelled",
            current_period_end=now,
            user_jwt=user_jwt,
            service=service,
        )

    # 3) založ nový active subscription (DEV: bez current_period_end)
    new_sub = db_insert_app_user_subscription(
        user_id=user_id,
        tier_code=tier_code,
        status="active",
        current_period_start=now,
        current_period_end=None,
        cancel_at_period_end=False,
        external_customer_id=None,
        external_subscription_id=None,
        meta={"source": "manual_dev"},
        user_jwt=user_jwt,
        service=service,
    )

    # 4) nastav flag na users
    user_row = db_set_user_app_subscription_tier(
        user_id=user_id,
        tier_code=tier_code,
        user_jwt=user_jwt,
        service=service,
    )

    return {
        "user": user_row,
        "active_subscription": new_sub,
        "tier": tier,
    }