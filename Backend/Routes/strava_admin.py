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
    db_admin_clear_strava_reconnect_cooldown, 
    db_get_strava_admin_status, 
)
from Modules.Strava.webhook_strava import _calc_reconnect_after, _can_connect_now


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

@router.get("/status/{user_id}")
def get_admin_status(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    """
    Diagnostický pohľad pre admin panel - live stav priamo z DB,
    service-mode (obchádza RLS aj require_user).
    """
    _verify_admin_auth(x_api_key)
    ctx = service_ctx(f"strava_admin.get_status.{user_id}")

    row = db_get_strava_admin_status(user_id=user_id, ctx=ctx)
    if not row:
        return {"success": True, "status": None}

    deauth_at = row.get("deauthorized_at")
    has_tokens = bool(row.get("access_token")) and bool(row.get("refresh_token"))
    connected = (not bool(deauth_at)) and has_tokens
    reconnect_after = _calc_reconnect_after(deauth_at) if deauth_at else None
    can_connect = True if connected is False and not deauth_at else _can_connect_now(row)[0]

    return {
        "success": True,
        "status": {
            "connected": connected,
            "athlete_id": row.get("athlete_id"),
            "deauthorized_at": deauth_at,
            "reconnect_after": reconnect_after,
            "can_connect": can_connect,
            "ever_synced_at": row.get("ever_synced_at"),
            "admin_override_days": row.get("admin_override_days"),
            "admin_override_note": row.get("admin_override_note"),
            "admin_override_granted_at": row.get("admin_override_granted_at"),
        },
    }


@router.post("/clear-cooldown/{user_id}")
def clear_reconnect_cooldown(user_id: int, x_api_key: Optional[str] = Header(default=None)):
    """Okamžite zruší reconnect cooldown, nech sa user môže znova pripojiť hneď."""
    _verify_admin_auth(x_api_key)
    ctx = service_ctx(f"strava_admin.clear_cooldown.{user_id}")
    ok = db_admin_clear_strava_reconnect_cooldown(user_id=user_id, ctx=ctx)
    if not ok:
        raise HTTPException(status_code=404, detail="strava_account_not_found")
    return {"success": True}