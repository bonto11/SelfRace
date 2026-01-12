from __future__ import annotations

from fastapi import APIRouter, Depends, Body, HTTPException
from pydantic import BaseModel

from Modules.HTTP.auth_deps import require_user_jwt
from Services.app_subscription import (
    service_list_app_subscription_tiers,
    service_get_user_app_subscription_status,
    service_list_user_app_subscriptions,
    service_set_user_app_subscription_tier_manual,
    service_cancel_scheduled_subscription_change,
)
from Services.AI.billing import (
    get_user_ai_quota_status_for_current_tier,
)

router = APIRouter(
    prefix="/app/subscription",
    tags=["app-subscription"],
)


@router.get("/tiers")
def list_app_subscription_tiers(
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        items = service_list_app_subscription_tiers(
            include_inactive=False,
            user_jwt=user_jwt,
            service=False,
        )
        return {"success": True, "items": items}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{user_id}")
def get_app_subscription_status(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        status = service_get_user_app_subscription_status(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,
        )

        # doplníme ai_quota pre FE (usage bar)
        try:
            quota = get_user_ai_quota_status_for_current_tier(
                user_id=user_id,
                user_jwt=user_jwt,
                service=False,
            )
        except Exception as qe:  # noqa: BLE001
            print("[APP_SUBSCRIPTION][status] ai_quota error:", repr(qe))
            quota = None

        if isinstance(status, dict) and isinstance(quota, dict):
            status["ai_quota"] = {
                "monthly_limit_tokens": quota.get("limit_tokens"),
                "used_tokens_this_month": quota.get("used_tokens"),
                "remaining_tokens": quota.get("remaining_tokens"),
                "is_over": quota.get("is_over"),
                "reset_at": quota.get("reset_at"),
            }

        return {"success": True, "status": status}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{user_id}")
def list_app_subscription_history(
    user_id: int,
    limit: int = 20,
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        items = service_list_user_app_subscriptions(
            user_id=user_id,
            limit=limit,
            user_jwt=user_jwt,
            service=False,
        )
        return {"success": True, "items": items}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


class SetTierPayload(BaseModel):
    tier_code: str


@router.post("/set-tier/{user_id}")
def set_user_app_subscription_tier_manual(
    user_id: int,
    payload: SetTierPayload = Body(...),
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        result = service_set_user_app_subscription_tier_manual(
            user_id=user_id,
            tier_code=payload.tier_code,
            user_jwt=user_jwt,
            service=False,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-scheduled/{user_id}")
def cancel_scheduled_subscription_change(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Zruší naplánovaný downgrade/cancel (keep current tier).
    """
    try:
        result = service_cancel_scheduled_subscription_change(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))