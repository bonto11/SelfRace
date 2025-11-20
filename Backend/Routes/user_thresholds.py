# Routes/user_thresholds.py
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from Services.user_thresholds import (
    load_user_thresholds,
    upsert_user_threshold,
    list_user_thresholds,
    list_latest_per_combo,
)

router = APIRouter(prefix="/users", tags=["users"])

class ThresholdPayload(BaseModel):
    sport: Optional[str] = None
    threshold_type: Optional[str] = None
    hr_bpm: Optional[float] = None
    pace_sec_km: Optional[float] = None
    power_watt: Optional[float] = None
    measurement_type: Optional[str] = None

@router.get("/{user_id}/thresholds")
def get_user_thresholds(user_id: int, sport: Optional[str] = None, type: Optional[str] = None):
    """Latest by sport+type (defaults running/LT2)"""
    try:
        thr = load_user_thresholds(user_id, sport or "running", type or "LT2")
        return {"success": True, "thresholds": thr}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/thresholds/all")
def get_user_thresholds_all(user_id: int):
    try:
        rows = list_user_thresholds(user_id)
        return {"success": True, "rows": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/thresholds/latest")
def get_user_thresholds_latest(user_id: int):
    """Latest per (sport,threshold_type)"""
    try:
        rows = list_latest_per_combo(user_id)
        return {"success": True, "rows": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/thresholds")
def put_user_thresholds(user_id: int, payload: ThresholdPayload):
    try:
        thr = upsert_user_threshold(user_id, payload.dict(exclude_unset=True))
        return {"success": True, "thresholds": thr}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))