from fastapi import APIRouter, Depends, HTTPException, Query

from Modules.HTTP.auth_deps import require_user_jwt

from Services.activities_review import service_get_activity_review

router = APIRouter()


@router.get("/activities/review/{user_id}/{activity_id}")
def get_activity_review(
    user_id: int,
    activity_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    print("get_activity_review IN", user_id, activity_id, user_jwt)

    out = service_get_activity_review(
        user_id=user_id, activity_id=activity_id, user_jwt=user_jwt, service=False
    )

    print("get_activity_review OUT", out)

    if out is None:
        return {"success": True, "review": None, "created_at": None}

    return {"success": True, **out}
