# (Tvoj router súbor pre coach_athlete)
from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Depends, Request

from Services.AI.athlete_state.main import (
    service_analyze_athlete,
    service_get_latest_athlete_state,
    service_list_athlete_states_meta,
    service_get_latest_athlete_progress,
)
from Schemas.coach_athlete_state import AnalyzeConfig
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/coach/athlete",
    tags=["coach-athlete"],
)

@router.post("/analyze/{user_id}")
def analyze_athlete(
    req: Request,
    user_id: int,
    payload: AnalyzeConfig | None = Body(None),
):
    try:
        ctx = require_user(get_auth_ctx(req))
        model = payload.model if payload and payload.model else None

        result = service_analyze_athlete(
            user_id=user_id,
            ctx=ctx,
            model=model,
        )
        
        # ✅ Skontrolujeme vnútorné "ok"
        if not result.get("ok"):
             return {
                 "success": False, 
                 "data": None, 
                 "error_code": result.get("code") or "REQUEST_FAILED",
                 "message": result.get("message")
             }

        return {"success": True, "data": result, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state/latest/{user_id}")
def get_latest_athlete_state(
    req: Request,
    user_id: int,
):
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_latest_athlete_state(
            user_id=user_id,
            ctx=ctx,
            version=1,
        )
        
        if not row:
             return {
                 "success": False, 
                 "data": None, 
                 "error_code": "NOT_FOUND",
                 "message": "Nepodarilo sa nájsť žiadny uložený stav."
             }
             
        return {"success": True, "data": row, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state/history/{user_id}")
def list_athlete_states_meta(
    req: Request,
    user_id: int,
    limit: int = 20,
):
    try:
        ctx = require_user(get_auth_ctx(req))
        rows = service_list_athlete_states_meta(
            user_id=user_id,
            limit=limit,
            ctx=ctx,
        )
        return {"success": True, "data": rows, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state/latest-progress/{user_id}")
def get_latest_athlete_progress(
    req: Request,
    user_id: int,
):
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_latest_athlete_progress(
            user_id=user_id,
            version=1,
            ctx=ctx,
        )
        
        if not row:
             return {
                 "success": False, 
                 "data": None, 
                 "error_code": "NOT_FOUND",
                 "message": "Nenašiel sa žiadny progress report."
             }
             
        return {"success": True, "data": row, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))