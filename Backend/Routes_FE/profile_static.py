# Routes_FE/profile_static.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from Services.profile_static import (
    service_get_static_profile,
    service_upsert_static_profile,
)
from Schemas.profile_static import StaticPayload
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/profile", tags=["profile-static"])


@router.get("/static/{user_id}")
def get_static(
    req: Request,
    user_id: int,
):
    """
    GET /profile/static/:user_id
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        row = service_get_static_profile(
            user_id=user_id,
            ctx=ctx,
        )
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/static/{user_id}")
def upsert_static(
    req: Request,
    user_id: int,
    payload: StaticPayload,
):
    """
    POST /profile/static/:user_id
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        row = service_upsert_static_profile(
            user_id=user_id,
            payload=payload,
            ctx=ctx,
        )
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))