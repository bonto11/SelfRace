# Routes_FE/notifications.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, Request

from Services.notifications import service_save_push_subscription, service_notify_test
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.post("/{user_id}/push-subscription")
def save_push_subscription(
    req: Request,
    user_id: int,
    subscription: Dict[str, Any] = Body(...),
):
    """
    Uloží 
    (upsert) Push Subscription objekt z prehliadača do DB.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        saved = service_save_push_subscription(
            user_id=user_id,
            subscription_data=subscription,
            ctx=ctx
        )
        return {"success": True, "saved": saved}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/{user_id}/test-push")
def test_push_notification(
    req: Request,
    user_id: int,
):
    """
    Endpoint na manuálne otestovanie push notifikácie (napríklad cez Swagger/Postman).
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        result = service_notify_test(
            user_id=user_id,
            ctx=ctx
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))