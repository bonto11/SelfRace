# Routes_API/users_pace_history.py
from fastapi import APIRouter, Request, Query
from Services.users_pace_history import (
    service_get_latest_paces,
    service_get_pace_history_trends
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/user-paces", tags=["user-paces"])

@router.get("/latest")
def get_latest_paces(req: Request, user_id: int):
    ctx = require_user(get_auth_ctx(req))
    return {"success": True, "data": service_get_latest_paces(user_id, ctx)}

@router.get("/trend")
def get_pace_trend(req: Request, user_id: int, days: int = 90):
    ctx = require_user(get_auth_ctx(req))
    return {"success": True, "trends": service_get_pace_history_trends(user_id, days, ctx)}