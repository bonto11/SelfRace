# Routes_FE/user_thresholds.py
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from Schemas.user_tresholds import ThresholdPayload
from Services.user_thresholds import (
    service_load_user_thresholds,
    service_upsert_user_threshold,
    service_list_user_thresholds,
    service_list_latest_per_combo,
)
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/thresholds")
def get_user_thresholds(
    user_id: int,
    sport: Optional[str] = None,
    type: Optional[str] = None,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """Latest by sport+type (defaults running/LT2)"""
    try:
        thr = service_load_user_thresholds(
            user_id,
            sport or "running",
            type or "LT2",
            user_jwt=user_jwt,
        )
        return {"success": True, "thresholds": thr}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/thresholds/all")
def get_user_thresholds_all(
    user_id: int,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        rows = service_list_user_thresholds(
            user_id,
            user_jwt=user_jwt,
        )
        return {"success": True, "rows": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/thresholds/latest")
def get_user_thresholds_latest(
    user_id: int,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """Latest per (sport,threshold_type)"""
    try:
        rows = service_list_latest_per_combo(
            user_id,
            user_jwt=user_jwt,
        )
        return {"success": True, "rows": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/thresholds")
def put_user_thresholds(
    user_id: int,
    payload: ThresholdPayload,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        thr = service_upsert_user_threshold(
            user_id,
            payload.dict(exclude_unset=True),
            user_jwt=user_jwt,
        )
        return {"success": True, "thresholds": thr}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))