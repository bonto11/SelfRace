# Routes_FE/user_thresholds.py
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from Schemas.user_tresholds import ThresholdPayload
from Services.user_thresholds import (
    service_load_user_thresholds,
    service_upsert_user_threshold,
    service_list_user_thresholds,
    service_list_latest_per_combo,
)
from Modules.HTTP.auth_deps import inject_user_jwt
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/thresholds")
def get_user_thresholds(
    req: Request,
    user_id: int,
    sport: Optional[str] = None,
    type: Optional[str] = None,
):
    """Latest by sport+type (defaults running/LT2)"""
    try:
        ctx = require_user(get_auth_ctx(req))

        thr = service_load_user_thresholds(
            user_id=user_id,
            sport=sport or "running",
            threshold_type=type or "LT2",
            ctx=ctx,
        )
        return {"success": True, "thresholds": thr}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/thresholds/all")
def get_user_thresholds_all(
    req: Request,
    user_id: int,
):
    try:
        ctx = require_user(get_auth_ctx(req))

        rows = service_list_user_thresholds(
            user_id=user_id,
            ctx=ctx,
        )
        return {"success": True, "rows": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/thresholds/latest")
def get_user_thresholds_latest(
    req: Request,
    user_id: int,
):
    """Latest per (sport,threshold_type)"""
    try:
        ctx = require_user(get_auth_ctx(req))

        rows = service_list_latest_per_combo(
            user_id=user_id,
            ctx=ctx,
        )
        return {"success": True, "rows": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/thresholds")
def put_user_thresholds(
    req: Request,
    user_id: int,
    payload: ThresholdPayload,
):
    try:
        ctx = require_user(get_auth_ctx(req))
        
        thr = service_upsert_user_threshold(
            user_id=user_id,
            payload=payload.dict(exclude_unset=True),
            ctx=ctx,
        )
        return {"success": True, "thresholds": thr}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))