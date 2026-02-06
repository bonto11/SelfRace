from fastapi import APIRouter, Depends, HTTPException, Query, Request

from Modules.HTTP.auth_deps import require_user_jwt

from Services.activities_review import service_get_activity_review

router = APIRouter()
from Modules.Supabase.auth import get_auth_ctx, require_user


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
