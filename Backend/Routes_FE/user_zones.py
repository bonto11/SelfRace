from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from Schemas.user_zones import ZonesPayload
from Services.user_zones import (
    service_load_user_zones,
    service_load_user_zones_all_latest,
    service_save_user_zones,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/zones")
def get_user_zones(
    req: Request,
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
        ctx = require_user(get_auth_ctx(req))

        if all:
            by_sport = service_load_user_zones_all_latest(
                user_id,
                ctx=ctx,
            )
            return {"success": True, "zones_by_sport": by_sport}

        latest = service_load_user_zones(
            user_id=user_id,
            sport=sport,
            ctx=ctx,
        )
        return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/zones")
def put_user_zones(
    req: Request,
    user_id: int,
    payload: ZonesPayload,
):
    """
    PUT /users/{user_id}/zones
    Body: { sport?, hr_max?, z1_min?, z1_max?, ... }

    -> použije service_save_user_zones()
       a vráti {"success": true, "zones": ZonesOut}
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        latest = service_save_user_zones(
            user_id=user_id,
            payload=payload.dict(exclude_unset=True),
            ctx=ctx,
        )
        return {"success": True, "zones": latest}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))