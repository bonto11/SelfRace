# Routes_FE/activities_streams.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends

from Services.activities_streams import (
    service_get_streams_one,
)
from Modules.HTTP.auth_deps import require_user_jwt

router = APIRouter(prefix="/activities_streams", tags=["activities_streams"])


@router.get("/{user_id}/{activity_id}")
def get_streams_one(
    user_id: int,
    activity_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        streams = service_get_streams_one(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=user_jwt,
        )
        return {"success": True, "streams": streams}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))