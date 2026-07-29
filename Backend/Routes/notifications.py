from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import get_auth_ctx, require_user, service_ctx
from Services.notifications import (
    service_save_push_subscription,
    service_delete_push_subscription,
    service_notify_test,
    service_notify_global,
    service_mark_push_received,
    service_cron_cleanup_stale_push_subscriptions,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])

def _require_api_key(x_api_key: str | None) -> None:
    """Overenie, že request na globálne notifikácie prichádza s platným API kľúčom."""
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

@router.post("/{user_id}/push-subscription")
def save_push_subscription(
    req: Request,
    user_id: int,
    subscription: Dict[str, Any] = Body(...),
):
    """
    Uloží (upsert) Push Subscription objekt z prehliadača do DB.
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

@router.delete("/{user_id}/push-subscription")
def delete_push_subscription(
    req: Request,
    user_id: int,
    endpoint: str = Body(..., embed=True),
):
    """
    Vymaže konkrétny Push Subscription (endpoint zariadenia) z databázy.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        # Voláme service vrstvu
        result = service_delete_push_subscription(
            user_id=user_id,
            endpoint=endpoint, 
            ctx=ctx
        )
        
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
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

@router.post("/global")
async def notify_global(
    messages: Dict[str, Dict[str, str]] = Body(..., embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Endpoint na manuálne poslanie hromadnej push notifikácie vo viacerých jazykoch.
    Chránené pomocou MAINTENANCE_API_KEY.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications.global")

    try:
        result = service_notify_global(
            messages=messages,
            ctx=ctx
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/push/received")
async def push_received_ack(
    payload: Dict[str, Any] = Body(...),
):
    """
    Volá VÝHRADNE Service Worker (public/sw.js) z 'push' event handlera,
    v momente keď zariadenie reálne dostane push — nezávisle od toho, čo
    o subscription hovorí Apple/FCM serveru pri odosielaní (Apple vie
    prijať 2xx aj pre už mŕtvu subscription). Toto je jediný nesporný
    dôkaz životnosti subscription — nastavuje last_received_at.

    ⚠️ ZÁMERNE bez autentifikácie (require_user/API kľúč) — Service Worker
    beží mimo bežného stránkového kontextu a nemá jednoducho dostupný JWT
    token ani sa doň nedá bezpečne vložiť MAINTENANCE_API_KEY (je to
    verejný statický JS súbor, ktokoľvek by si ho vedel prečítať priamo
    z prehliadača). Riziko je nízke: sub_id samo osebe nie je citlivé a
    v najhoršom prípade niekto oneskorí zmazanie jedného konkrétneho
    riadku v cleanup crone.
    """
    sub_id = payload.get("sub_id")
    if sub_id is None:
        raise HTTPException(status_code=400, detail="missing sub_id")

    try:
        ctx = service_ctx("notifications.push_received")
        result = service_mark_push_received(sub_id=int(sub_id), ctx=ctx)
        return result
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="sub_id must be an integer")
    except Exception as e:  # noqa: BLE001
        # Zámerne nevraciame 500 s detailmi navonok - je to fire-and-forget
        # volanie zo Service Workera (má keepalive:true, ale nikto nečíta
        # odpoveď), stačí to zalogovať.
        print(f"[Push][ack] failed for sub_id={sub_id}: {repr(e)}")
        raise HTTPException(status_code=500, detail="internal error")
