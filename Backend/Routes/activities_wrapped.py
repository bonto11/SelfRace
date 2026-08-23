# Routes/activities_wrapped.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Header, HTTPException, Request
from pydantic import BaseModel

from Modules.Supabase.auth import get_auth_ctx, require_user, service_ctx
from Configs.config import MAINTENANCE_API_KEY
from Services.activities_wrapped import (
    service_get_activities_wrapped_status,
    service_generate_activities_wrapped,
    service_run_activities_wrapped_trigger_scan,
    service_admin_unlock_activities_wrapped,
    service_admin_get_trigger_status,
)
from DB.activities_wrapped import db_get_activities_wrapped_summary_by_id

router = APIRouter(prefix="/activities-wrapped", tags=["activities-wrapped"])


def _require_admin_api_key(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Admin API Key")


@router.get("/{user_id}/status")
def get_status(req: Request, user_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        return {"success": True, **service_get_activities_wrapped_status(user_id=user_id, ctx=ctx)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


class GenerateWrappedPayload(BaseModel):
    title: str
    range_start: str
    range_end: str


@router.post("/{user_id}/generate")
def generate(req: Request, user_id: int, payload: GenerateWrappedPayload = Body(...)):
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_generate_activities_wrapped(
            user_id=user_id,
            title=payload.title,
            range_start=payload.range_start,
            range_end=payload.range_end,
            ctx=ctx,
        )
        return result
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/{summary_id}")
def get_one(req: Request, user_id: int, summary_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        row = db_get_activities_wrapped_summary_by_id(summary_id, user_id, ctx=ctx)
        return {"success": True, "item": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ---------- ADMIN / CRON ----------

@router.post("/admin/scan")
def admin_scan(x_api_key: Optional[str] = Header(default=None)):
    _require_admin_api_key(x_api_key)
    ctx = service_ctx("activities_wrapped.admin_scan")
    return service_run_activities_wrapped_trigger_scan(ctx=ctx)


@router.get("/admin/status/{user_id}")
def admin_status(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    """Pre admin panel - aktuálny stav triggeru pre usera (aktívny? dokedy?)."""
    _require_admin_api_key(x_api_key)
    ctx = service_ctx(f"activities_wrapped.admin_status.{user_id}")
    return {"success": True, **service_admin_get_trigger_status(user_id=user_id, ctx=ctx)}


class AdminUnlockPayload(BaseModel):
    label: Optional[str] = None
    valid_days: int = 14


@router.post("/admin/unlock/{user_id}")
def admin_unlock(
    user_id: int,
    payload: AdminUnlockPayload = Body(default=AdminUnlockPayload()),
    x_api_key: Optional[str] = Header(default=None),
):
    _require_admin_api_key(x_api_key)
    ctx = service_ctx(f"activities_wrapped.admin_unlock.{user_id}")
    return service_admin_unlock_activities_wrapped(
        user_id=user_id, label=payload.label, valid_days=payload.valid_days, ctx=ctx
    )