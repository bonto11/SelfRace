# Routes_FE/notifications_timed.py
from __future__ import annotations

from typing import Dict
from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse

from Services.notifications import (
    service_cron_notify_recovery,
    service_cron_notify_review,
    service_cron_notify_training,
    service_notify_global,
)
from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx

router = APIRouter(prefix="/notifications-timed", tags=["notifications-timed"])

def _require_api_key(x_api_key: str | None) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

@router.post("/recovery")
async def timed_notify_recovery(
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.recovery")

    try:
        result = service_cron_notify_recovery(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/review")
async def timed_notify_review(
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.review")

    try:
        result = service_cron_notify_review(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/training")
async def timed_notify_training(
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.training")

    try:
        result = service_cron_notify_training(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/global")
async def timed_notify_global(
    messages: Dict[str, Dict[str, str]] = Body(...),
    x_api_key: str | None = Header(default=None),
):
    """
    Endpoint na manuálne poslanie hromadnej push notifikácie vo viacerých jazykoch.
    Chránené pomocou MAINTENANCE_API_KEY.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.global")

    try:
        result = service_notify_global(
            messages=messages,
            ctx=ctx
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)