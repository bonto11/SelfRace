# Routes_FE/activities_review

from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict, Optional
from pydantic import BaseModel

from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.activities_review import (
    service_get_activity_review,
    service_request_activity_review_rerun,  # ✅ NEW
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter()

class ActivityReviewRerunPayload(BaseModel):
    comment: Optional[str] = None
    model: Optional[str] = None




@router.get("/activities/review/{user_id}/{activity_id}")
def get_activity_review(
    user_id: int,
    activity_id: int,
    req: Request,
):
    ctx = require_user(get_auth_ctx(req))

    out = service_get_activity_review(
        user_id=user_id, activity_id=activity_id, ctx=ctx,
    )

    if out is None:
        return {"success": True, "review": None, "updated_at": None}

    return {"success": True, **out}


@router.post("/activities/review/{user_id}/{activity_id}/rerun")
def rerun_activity_review(
    user_id: int,
    activity_id: int,
    payload: ActivityReviewRerunPayload,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))

    print("payload",payload)
    out = service_request_activity_review_rerun(
        user_id=int(user_id),
        activity_id=int(activity_id),
        comment=payload.comment,
        model=payload.model,
        ctx=ctx,
    )

    # dôležité: FE chce dostať odpoveď aj pri limite
    # => nevyhadzuj HTTPException, vráť success:false + out
    if not out.get("ok"):
        return {"success": False, **out}

    return {"success": True, **out}