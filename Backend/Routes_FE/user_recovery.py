# Routes_FE/user_recovery.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from Services.user_recovery import (
    service_insert_or_update_recovery,
    service_get_recovery,
)
from Schemas.user_recovery import RecoveryIn
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/recovery", tags=["recovery"])


@router.post("")
def post_recovery(
    req: Request,
    payload: RecoveryIn,
):
    try:
        ctx = require_user(get_auth_ctx(req))

        res = service_insert_or_update_recovery(
            payload=payload.model_dump(),
            ctx=ctx,
        )
        return {"success": True, "data": res}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
def get_recovery(
    req: Request,
    user_id: int,
    days: int = 14,
):
    try:
        ctx = require_user(get_auth_ctx(req))

        data = service_get_recovery(
            user_id=user_id,
            days=days,
            ctx=ctx,
        )
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))