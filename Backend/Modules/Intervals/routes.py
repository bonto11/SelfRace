# Modules/Intervals/routes.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from Modules.Intervals.config import MAX_SYNC_DAYS
from Modules.Intervals.connect import (
    service_intervals_connect,
    service_intervals_disconnect,
    service_intervals_status,
)
from Modules.Intervals.sync import service_intervals_sync_user
from Modules.Intervals.workouts import (
    PUSH_DAYS,
    service_intervals_push_workouts,
    set_push_enabled,
)
from Modules.Supabase.auth import get_auth_ctx, require_user
from Modules.Supabase.ownership import is_owner

router = APIRouter(prefix="/integrations/intervals", tags=["integrations"])


class IntervalsSyncIn(BaseModel):
    user_id: int = Field(..., ge=1)
    days: int = Field(default=7, ge=1, le=MAX_SYNC_DAYS)

    model_config = ConfigDict(extra="forbid")


class IntervalsConnectIn(BaseModel):
    user_id: int = Field(..., ge=1)
    athlete_id: str = Field(..., min_length=1, max_length=32)
    api_key: str = Field(..., min_length=1, max_length=200)

    model_config = ConfigDict(extra="forbid")


class IntervalsDisconnectIn(BaseModel):
    user_id: int = Field(..., ge=1)

    model_config = ConfigDict(extra="forbid")


class IntervalsPushIn(BaseModel):
    user_id: int = Field(..., ge=1)
    days: int = Field(default=PUSH_DAYS, ge=1, le=28)

    model_config = ConfigDict(extra="forbid")


class IntervalsPushSettingsIn(BaseModel):
    user_id: int = Field(..., ge=1)
    enabled: bool

    model_config = ConfigDict(extra="forbid")


@router.get("/status/{user_id}")
def get_intervals_status(req: Request, user_id: int):
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    return {"success": True, "data": service_intervals_status(user_id)}


@router.post("/connect")
def post_intervals_connect(req: Request, payload: IntervalsConnectIn):
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, payload.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        res = service_intervals_connect(
            payload.user_id, payload.athlete_id, payload.api_key, ctx=ctx
        )
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] connect failed user={payload.user_id}: {repr(e)}")
        return {"success": False, "error_code": "intervals_connect_failed"}

    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code")}
    return {"success": True, "data": res}


@router.post("/disconnect")
def post_intervals_disconnect(req: Request, payload: IntervalsDisconnectIn):
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, payload.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        service_intervals_disconnect(payload.user_id)
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] disconnect failed user={payload.user_id}: {repr(e)}")
        return {"success": False, "error_code": "intervals_disconnect_failed"}
    return {"success": True, "data": {"connected": False}}


@router.post("/sync")
def post_intervals_sync(req: Request, payload: IntervalsSyncIn):
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, payload.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        res = service_intervals_sync_user(payload.user_id, payload.days, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code")}
    return {"success": True, "data": res}


@router.post("/push")
def post_intervals_push(req: Request, payload: IntervalsPushIn):
    """Pošle plán na najbližšie dni do intervals.icu (odtiaľ do Garminu)."""
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, payload.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        res = service_intervals_push_workouts(payload.user_id, ctx=ctx, days=payload.days)
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] push failed user={payload.user_id}: {repr(e)}")
        return {"success": False, "error_code": "intervals_push_failed"}
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code")}
    return {"success": True, "data": res}


@router.post("/push-settings")
def post_intervals_push_settings(req: Request, payload: IntervalsPushSettingsIn):
    """
    Zapne/vypne automatické posielanie plánu. Pri zapnutí sa plán pošle
    hneď – user nemá čakať na ranný cron, kým uvidí tréning v hodinkách.
    """
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, payload.user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    try:
        set_push_enabled(payload.user_id, payload.enabled, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] push settings failed user={payload.user_id}: {repr(e)}")
        return {"success": False, "error_code": "intervals_push_settings_failed"}

    pushed = None
    if payload.enabled:
        try:
            pushed = service_intervals_push_workouts(payload.user_id, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[INTERVALS] initial push failed user={payload.user_id}: {repr(e)}")
            pushed = {"ok": False, "code": "intervals_push_failed"}
    return {"success": True, "data": {"push_workouts": payload.enabled, "pushed": pushed}}
