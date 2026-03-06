# Routes_FE/users_pace_history.py
from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Query, Request

from Services.users_pace_history import (
    service_get_latest_paces,
    service_save_pace_history,
    service_get_pace_history_trends,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}/pace_history")
def get_latest_pace_history(req: Request, user_id: int):
    """
    GET /users/{user_id}/pace_history
    Vráti najnovší riadok s odhadmi a tempami.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_latest_paces(user_id=user_id, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/pace_history/trends")
def get_pace_history_trends(
    req: Request, 
    user_id: int, 
    days: int = Query(90, description="Počet dní pre trend")
):
    """
    GET /users/{user_id}/pace_history/trends?days=90
    Vráti pole riadkov chronologicky zoradených pre Frontend grafy.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_get_pace_history_trends(user_id=user_id, days=days, ctx=ctx)
        return {"success": True, "trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/pace_history")
def save_pace_history(req: Request, user_id: int, payload: Dict[str, Any]):
    """
    POST /users/{user_id}/pace_history
    Vytvorí nový historický snapshot temp (využívané AI analytikom/backendom).
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_save_pace_history(user_id=user_id, payload=payload, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
