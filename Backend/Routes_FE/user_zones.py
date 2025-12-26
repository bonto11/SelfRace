# Routes_FE/user_zones.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from Schemas.user_zones import ZonesPayload
from Services.user_zones import (
    service_load_user_zones,
    service_load_user_zones_all_latest,
    service_save_user_zones,
)
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/zones")
def get_user_zones(
    user_id: int,
    sport: Optional[str] = Query(None, description="napr. running/cycling"),
    all: bool = Query(False, description="vráť najnovšie podľa každého športu"),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
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
            by_sport = service_load_user_zones_all_latest(
                user_id,
                user_jwt=user_jwt,
            )
            return {"success": True, "zones_by_sport": by_sport}

        latest = service_load_user_zones(
            user_id,
            sport,
            user_jwt=user_jwt,
        )
        return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/zones")
def put_user_zones(
    user_id: int,
    payload: ZonesPayload,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    PUT /users/{user_id}/zones
    Body: { sport?, hr_max?, z1_min?, z1_max?, ... }

    -> použije service_save_user_zones()
       a vráti {"success": true, "zones": ZonesOut}
    """
    try:
        latest = service_save_user_zones(
            user_id,
            payload.dict(exclude_unset=True),
            user_jwt=user_jwt,
        )
        return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))