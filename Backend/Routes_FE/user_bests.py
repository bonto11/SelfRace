# Routes_FE/user_bests.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException, Request

from Services.user_bests import (
    service_fetch_user_bests,
    service_upsert_user_best,
    service_delete_user_best,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/bests")
def get_bests(
    req: Request,
    user_id: int,
    sport: str = "run",
):
    try:
        ctx = require_user(get_auth_ctx(req))
        
        bests = service_fetch_user_bests(
            user_id=user_id,
            sport=sport,
            ctx=ctx,
        )
        return {"success": True, "bests": bests}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/bests")
def put_best(
    req: Request,
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    try:
        ctx = require_user(get_auth_ctx(req))

        saved = service_upsert_user_best(
            user_id=user_id,
            payload=payload,
            ctx=ctx,
        )
        return {"success": True, "saved": saved}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/bests/{sport}/{distance_m}")
def del_best(
    req: Request,
    user_id: int,
    sport: str,
    distance_m: int,
):
    try:
        ctx = require_user(get_auth_ctx(req))

        deleted = service_delete_user_best(
            user_id=user_id,
            sport=sport,
            distance_m=int(distance_m),
            ctx=ctx,
        )
        return {"success": True, "deleted": deleted}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))