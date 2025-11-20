# Routes/user_zones.py
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from Services.user_zones import (
    load_user_zones_latest,
    load_user_zones_all_latest,
    save_user_zones,
)

router = APIRouter(prefix="/users", tags=["users"])

class ZonesPayload(BaseModel):
    sport: Optional[str] = None
    hr_max: Optional[int] = None; hr_max_bpm: Optional[int] = None
    z1_min: Optional[int] = None; z1_max: Optional[int] = None
    z2_min: Optional[int] = None; z2_max: Optional[int] = None
    z3_min: Optional[int] = None; z3_max: Optional[int] = None
    z4_min: Optional[int] = None; z4_max: Optional[int] = None
    z5_min: Optional[int] = None; z5_max: Optional[int] = None

@router.get("/{user_id}/zones")
def get_user_zones(
    user_id: int,
    sport: Optional[str] = Query(None, description="napr. running/cycling"),
    all: bool = Query(False, description="vráť najnovšie podľa každého športu"),
):
    try:
        if all:
            return {"success": True, "zones_by_sport": load_user_zones_all_latest(user_id)}
        return {"success": True, "zones": load_user_zones_latest(user_id, sport)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/zones")
def put_user_zones(user_id: int, payload: ZonesPayload):
    try:
        latest = save_user_zones(user_id, payload.dict(exclude_unset=True))
        return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))