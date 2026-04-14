# Routes_API/users_pace_history.py
from fastapi import APIRouter, HTTPException, Request

from Services.user_pace_history import (
    service_get_latest_paces,
    service_get_pace_history_trends,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/user-paces", tags=["user-paces"])


@router.get("/latest")
def get_latest_paces(req: Request, user_id: int):

    try:
        ctx = require_user(get_auth_ctx(req))
        latest = service_get_latest_paces(user_id=user_id, ctx=ctx)

        return {"success": True, "data": latest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trend")
def get_pace_trend(req: Request, user_id: int, days: int = 90):

    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_get_pace_history_trends(user_id=user_id, days=days, ctx=ctx)

        return {"success": True, "trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
