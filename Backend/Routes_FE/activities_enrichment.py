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
    injury: Optional[Dict[str, Any]] = None  # ✅ PRIDANÉ: Prijatie objektu zranenia

@router.post("/reviewRun/{user_id}/{activity_id}")
def rerun_activity_review(
    user_id: int,
    activity_id: int,
    payload: ActivityReviewRerunPayload,
    req: Request,
) -> Dict[str, Any]:
    """
    Endpoint na manuálne vyžiadanie (rerun) AI review.
    Očakáva JSON body: { "comment": "...", "model": "...", "injury": {...} }
    """
    ctx = require_user(get_auth_ctx(req))

    print("rerun_activity_review",user_id,activity_id,payload)
    
    out = service_request_activity_review_rerun(
        user_id=int(user_id),
        activity_id=int(activity_id),
        comment=payload.comment,
        model=payload.model,
        injury=payload.injury, # ✅ PRIDANÉ: Poslanie do service vrstvy
        ctx=ctx,
    )

    if not out.get("ok"):
        return {"success": False, **out}

    return {"success": True, **out}

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
    return {"success": True, "data": data}
