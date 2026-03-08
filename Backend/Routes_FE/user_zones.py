# Routes_FE/user_zones.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from Schemas.user_zones import ZonesPayload
from Services.user_zones import (
    service_load_user_zones,
    service_load_user_zones_all_latest,
    service_save_user_zones,
    service_load_zone_trends,
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
    try:
        ctx = require_user(get_auth_ctx(req))

        if all:
            by_sport = service_load_user_zones_all_latest(user_id, ctx=ctx)
            return {"success": True, "zones_by_sport": by_sport}

        latest = service_load_user_zones(user_id=user_id, sport=sport, ctx=ctx)
        return {"success": True, "zones": latest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/zones/trends")
def get_user_zone_trends(
    req: Request,
    user_id: int,
    sport: str = Query("run", description="Šport pre trendy, default: run"),
    days: int = Query(90, description="Počet dní do minulosti"),
):
    """
    GET /users/{user_id}/zones/trends?sport=run&days=90
    Vráti historické pole zón zoradené chronologicky pre FE grafy.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_load_zone_trends(
            user_id=user_id, sport=sport, days=days, ctx=ctx
        )

        return {"success": True, "trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/zones")
def put_user_zones(
    req: Request,
    user_id: int,
    payload: ZonesPayload,
):
    try:
        ctx = require_user(get_auth_ctx(req))
        latest = service_save_user_zones(
            user_id=user_id,
            payload=payload.dict(exclude_unset=True),
            ctx=ctx,
        )
        return {"success": True, "zones": latest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
