# Routes_FE/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from Schemas.coach_plan_weekly import WeeklyGenerateConfig
from Services.AI.weekly_plan.main import (
    service_generate_weekly_plan,
    service_get_latest_weekly_plan,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/coach-plan-weekly",
    tags=["coach-plan-weekly"],
)

@router.post("/generate/{user_id}")
def generate_weekly_plan(
    req: Request,
    user_id: int,
    payload: WeeklyGenerateConfig,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_generate_weekly_plan(
            user_id=user_id,
            ctx=ctx,
            overwrite=payload.overwrite,
            full_reset=payload.full_reset,
            state_id=payload.state_id,
            weeks=payload.weeks,
            model=payload.model,
        )
        
        # ✅ Skontrolujeme vnútorné "ok" z workera
        if not result.get("ok"):
             return {
                 "success": False, 
                 "data": None, 
                 "error_code": result.get("code") or "REQUEST_FAILED",
                 "message": result.get("message")
             }

        return {"success": True, "data": result, "error_code": None, "message": None}
        
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest/{user_id}")
def get_latest_weekly_plan(
    req: Request,
    user_id: int,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        plan = service_get_latest_weekly_plan(
            user_id=user_id,
            ctx=ctx,
        )
        
        if not plan:
             return {
                 "success": False, 
                 "data": None, 
                 "error_code": "NOT_FOUND",
                 "message": "Nenašiel sa žiadny aktívny týždenný plán."
             }
             
        return {"success": True, "data": plan, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))