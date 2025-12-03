# Routes_FE/user_zones.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from Services.user_zones import (
    service_load_user_zones,
    service_load_user_zones_all_latest,
    service_save_user_zones,
)

router = APIRouter(prefix="/users", tags=["users"])


class ZonesPayload(BaseModel):
    # voliteľný športový kontext
    sport: Optional[str] = None

    # HRmax aliasy
    hr_max: Optional[int] = None
    hr_max_bpm: Optional[int] = None

    # zóny (FE shape)
    z1_min: Optional[int] = None
    z1_max: Optional[int] = None
    z2_min: Optional[int] = None
    z2_max: Optional[int] = None
    z3_min: Optional[int] = None
    z3_max: Optional[int] = None
    z4_min: Optional[int] = None
    z4_max: Optional[int] = None
    z5_min: Optional[int] = None
    z5_max: Optional[int] = None  # v DB sa horná hranica Z5 odvádza z HRmax, nechávame kvôli FE


@router.get("/{user_id}/zones")
def get_user_zones(
    user_id: int,
    sport: Optional[str] = Query(None, description="napr. running/cycling"),
    all: bool = Query(False, description="vráť najnovšie podľa každého športu"),
):
    """
    GET /users/{user_id}/zones?sport=running
    GET /users/{user_id}/zones?all=true

    FE kontrakt zostáva:
      - ak all=false → {"success": true, "zones": ZonesOut | null}
      - ak all=true  → {"success": true, "zones_by_sport": { sport: ZonesOut }}
    """
    try:
      if all:
          by_sport = service_load_user_zones_all_latest(user_id)
          return {"success": True, "zones_by_sport": by_sport}

      latest = service_load_user_zones(user_id, sport)
      return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
      raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/zones")
def put_user_zones(user_id: int, payload: ZonesPayload):
    """
    PUT /users/{user_id}/zones
    Body: { sport?, hr_max?, z1_min?, z1_max?, ... }

    -> použije service_save_user_zones()
       a vráti {"success": true, "zones": ZonesOut}
    """
    try:
        latest = service_save_user_zones(user_id, payload.dict(exclude_unset=True))
        return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))