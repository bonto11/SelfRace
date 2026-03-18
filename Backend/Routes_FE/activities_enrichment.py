# Routes_FE/activities_enrichment.py
from fastapi import APIRouter, Request
from typing import Any, Dict, Optional
from pydantic import BaseModel

from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.activities_enrichment import (
    service_request_activity_review_rerun,
    service_get_activity_enrichment,
)

router = APIRouter(prefix="/activities/enrichment", tags=["activities/enrichment"])

class ActivityReviewRerunPayload(BaseModel):
    comment: Optional[str] = None
    model: Optional[str] = None
    has_new_injury: Optional[bool] = False
    is_race_effort: Optional[bool] = False

@router.post("/reviewRun/{user_id}/{activity_id}")
def rerun_activity_review(
    user_id: int,
    activity_id: int,
    payload: ActivityReviewRerunPayload,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))

    out = service_request_activity_review_rerun(
        user_id=int(user_id),
        activity_id=int(activity_id),
        comment=payload.comment,
        model=payload.model,
        has_new_injury=payload.has_new_injury,
        is_race_effort=payload.is_race_effort,
        ctx=ctx,
    )

    if not out.get("ok"):
        return {
            "success": False, 
            "data": None, 
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": out.get("message")
        }

    return {
        "success": True, 
        "data": out, 
        "error_code": None,
        "message": None
    }

@router.get("/{user_id}/{activity_id}")
def get_activity_enrichment(
    user_id: int,
    activity_id: int,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    data = service_get_activity_enrichment(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    
    if not data:
        return {
            "success": False, 
            "data": None, 
            "error_code": "NOT_FOUND",
            "message": "Enrichment data not found."
        }
        
    return {
        "success": True, 
        "data": data, 
        "error_code": None,
        "message": None
    }