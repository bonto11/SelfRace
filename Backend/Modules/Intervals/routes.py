# Modules/Intervals/routes.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from Modules.Intervals.config import MAX_SYNC_DAYS
from Modules.Intervals.db import db_intervals_get_account
from Modules.Intervals.sync import service_intervals_sync_user
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/integrations/intervals", tags=["integrations"])


class IntervalsSyncIn(BaseModel):
    user_id: int = Field(..., ge=1)
    days: int = Field(default=7, ge=1, le=MAX_SYNC_DAYS)

    model_config = ConfigDict(extra="forbid")


@router.get("/status/{user_id}")
def get_intervals_status(req: Request, user_id: int):
    require_user(get_auth_ctx(req))
    try:
        enabled = db_intervals_get_account(user_id) is not None
    except Exception as e:  # noqa: BLE001
        # Chýbajúca tabuľka (pred migráciou) = integrácia vypnutá, nie 500.
        print(f"[INTERVALS] status failed user={user_id}: {repr(e)}")
        enabled = False
    return {"success": True, "data": {"enabled": enabled}}


@router.post("/sync")
def post_intervals_sync(req: Request, payload: IntervalsSyncIn):
    # Zápis ide cez user ctx (RLS) – aj keby niekto poslal cudzie user_id,
    # do cudzieho recovery nezapíše.
    ctx = require_user(get_auth_ctx(req))
    try:
        res = service_intervals_sync_user(payload.user_id, payload.days, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code")}
    return {"success": True, "data": res}
