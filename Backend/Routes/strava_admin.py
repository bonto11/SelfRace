from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header, HTTPException, status, Body
from pydantic import BaseModel, Field

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from DB.account import (
    db_get_strava_admin_override,
    db_set_strava_admin_override,
    db_clear_strava_admin_override,
)

router = APIRouter(prefix="/api/strava/admin", tags=["strava-admin"])


def _verify_admin_auth(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        print("[AUTH ERROR ADMIN] Invalid Maintenance API Key used (strava_admin).")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Admin API Key",
        )


class SetOverridePayload(BaseModel):
    days: int = Field(..., gt=0, le=3650)
    note: Optional[str] = None


@router.get("/override/{user_id}")
def get_override(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    _verify_admin_auth(x_api_key)
    ctx = service_ctx(f"strava_admin.get_override.{user_id}")
    override = db_get_strava_admin_override(user_id=user_id, ctx=ctx)
    return {"success": True, "override": override}


@router.post("/override/{user_id}")
def set_override(
    user_id: int,
    payload: SetOverridePayload = Body(...),
    x_api_key: Optional[str] = Header(default=None),
):
    _verify_admin_auth(x_api_key)
    ctx = service_ctx(f"strava_admin.set_override.{user_id}")
    ok = db_set_strava_admin_override(
        user_id=user_id,
        days=payload.days,
        note=payload.note,
        ctx=ctx,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="strava_account_not_found")
    return {"success": True}


@router.delete("/override/{user_id}")
def clear_override(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    _verify_admin_auth(x_api_key)
    ctx = service_ctx(f"strava_admin.clear_override.{user_id}")
    ok = db_clear_strava_admin_override(user_id=user_id, ctx=ctx)
    return {"success": True, "cleared": ok}
