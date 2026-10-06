# Routes/welcome_week.py
"""Admin endpointy pre uvítací týždeň (admin panel, x-api-key)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Header, HTTPException
from pydantic import BaseModel

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from Services.welcome_week import (
    service_welcome_admin_clear,
    service_welcome_admin_get,
    service_welcome_admin_set,
)

router = APIRouter(prefix="/welcome-week", tags=["welcome-week"])


def _require_admin_api_key(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Admin API Key")


@router.get("/admin/status/{user_id}")
def admin_status(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    _require_admin_api_key(x_api_key)
    ctx = service_ctx(f"welcome_week.admin_status.{user_id}")
    return {"success": True, **service_welcome_admin_get(user_id, ctx=ctx)}


class AdminSetPayload(BaseModel):
    days: int = 7
    start: Optional[str] = None  # YYYY-MM-DD, prázdne = odteraz
    note: Optional[str] = None


@router.post("/admin/set/{user_id}")
def admin_set(
    user_id: int,
    payload: AdminSetPayload = Body(default=AdminSetPayload()),
    x_api_key: Optional[str] = Header(default=None),
):
    _require_admin_api_key(x_api_key)
    ctx = service_ctx(f"welcome_week.admin_set.{user_id}")
    out = service_welcome_admin_set(
        user_id, days=payload.days, start=payload.start, note=payload.note, ctx=ctx
    )
    return {"success": bool(out.get("ok")), **out}


@router.post("/admin/clear/{user_id}")
def admin_clear(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    _require_admin_api_key(x_api_key)
    ctx = service_ctx(f"welcome_week.admin_clear.{user_id}")
    return {"success": True, **service_welcome_admin_clear(user_id, ctx=ctx)}
