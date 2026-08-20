from __future__ import annotations

from fastapi import APIRouter, Body, Header, HTTPException, Request
from pydantic import BaseModel
from typing import Optional


from Services.app_subscription import (
    service_list_app_subscription_tiers,
    service_get_user_app_subscription_status,
    service_list_user_app_subscriptions,
    service_set_user_app_subscription_tier_manual,
    service_cancel_scheduled_subscription_change,
)
from Services.AI.utils.billing import (
    get_user_ai_quota_status_for_current_tier,
)
from Modules.Supabase.auth import get_auth_ctx, require_user, service_ctx
from Configs.config import MAINTENANCE_API_KEY

router = APIRouter(
    prefix="/app/subscription",
    tags=["app-subscription"],
)


def _require_admin_api_key(x_api_key: Optional[str]) -> None:
    """Overenie, že request prichádza z Admin panela (rovnaký vzor ako
    ostatné admin/systémové endpointy — Strava override, notifikácie)."""
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        print("[AUTH ERROR ADMIN][app_subscription] Invalid Maintenance API Key used.")
        raise HTTPException(status_code=401, detail="Invalid Admin API Key")


def _resolve_ctx_admin_or_user(req: Request, x_api_key: Optional[str], *, label: str):
    """
    Dvojitý vstupný bod:
    - Ak prišiel platný x-api-key -> admin/systémový prístup (service_ctx,
      obchádza RLS, môže pracovať s ľubovoľným user_id z URL).
    - Inak -> bežný prihlásený user (require_user), presne ako doteraz -
      appka (BillingPanel) naďalej funguje bez zmeny.
    """
    if x_api_key and MAINTENANCE_API_KEY and x_api_key == MAINTENANCE_API_KEY:
        return service_ctx(label)
    return require_user(get_auth_ctx(req))


@router.get("/tiers")
def list_app_subscription_tiers(
    req: Request,
    x_api_key: Optional[str] = Header(default=None),
):
    try:
        ctx = _resolve_ctx_admin_or_user(req, x_api_key, label="app_subscription.tiers")

        items = service_list_app_subscription_tiers(
            include_inactive=False,
            ctx=ctx,
        )
        return {"success": True, "items": items}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{user_id}")
def get_app_subscription_status(
    req: Request,
    user_id: int,
    x_api_key: Optional[str] = Header(default=None),
):
    try:
        ctx = _resolve_ctx_admin_or_user(
            req, x_api_key, label=f"app_subscription.status.{user_id}"
        )

        status = service_get_user_app_subscription_status(
            user_id=user_id,
            ctx=ctx,
        )

        try:
            quota = get_user_ai_quota_status_for_current_tier(
                user_id=user_id,
                ctx=ctx,
            )
        except Exception as qe:  # noqa: BLE001
            print("[APP_SUBSCRIPTION][status] ai_quota error:", repr(qe))
            quota = None

        if isinstance(status, dict) and isinstance(quota, dict):
            status["ai_quota"] = {
                "limits": quota.get("limits", {}),
                "usage": quota.get("usage", {}),
                "remaining": quota.get("remaining", {}),
                "is_over": quota.get("is_over", False),
                "reset_at": quota.get("reset_at"),
            }

        return {"success": True, "status": status}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{user_id}")
def list_app_subscription_history(
    req: Request,
    user_id: int,
    limit: int = 20,
    x_api_key: Optional[str] = Header(default=None),
):
    try:
        ctx = _resolve_ctx_admin_or_user(
            req, x_api_key, label=f"app_subscription.history.{user_id}"
        )

        items = service_list_user_app_subscriptions(
            user_id=user_id,
            limit=limit,
            ctx=ctx,
        )
        return {"success": True, "items": items}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


class SetTierPayload(BaseModel):
    tier_code: str
    period_end: Optional[str] = None  # ISO datetime string, voliteľný custom dátum vypršania
    note: Optional[str] = None


@router.post("/set-tier/{user_id}")
def set_user_app_subscription_tier_manual(
    req: Request,
    user_id: int,
    payload: SetTierPayload = Body(...),
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Manuálne (admin/dev) nastavenie tieru pre usera. Vždy chránené API kľúčom
    - nie je určené pre bežný user-facing flow (na to slúži Stripe checkout).
    """
    try:
        _require_admin_api_key(x_api_key)
        ctx = service_ctx(f"app_subscription.set_tier.{user_id}")

        result = service_set_user_app_subscription_tier_manual(
            user_id=user_id,
            tier_code=payload.tier_code,
            period_end_iso=payload.period_end,
            note=payload.note,
            ctx=ctx,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-scheduled/{user_id}")
def cancel_scheduled_subscription_change(
    req: Request,
    user_id: int,
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Zruší naplánovaný downgrade/cancel (keep current tier).
    Dostupné pre bežného usera (svoje vlastné predplatné) aj pre admina
    (cez x-api-key, pre ľubovoľného usera).
    """
    try:
        ctx = _resolve_ctx_admin_or_user(
            req, x_api_key, label=f"app_subscription.cancel_scheduled.{user_id}"
        )

        result = service_cancel_scheduled_subscription_change(
            user_id=user_id,
            ctx=ctx,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))