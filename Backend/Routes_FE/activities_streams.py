# Routes_FE/activities.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from Services.activities_streams import (
    service_get_streams_one,
)

router = APIRouter(prefix="/activities_streams", tags=["activities_streams"])

@router.get("/{user_id}/{activity_id}")
def get_streams_one(
    activity_id: int,
    user_id: int,
):
    try:
        streams = service_get_streams_one(
            user_id=user_id,
            activity_id=activity_id,
        )
        print(",streams",streams)
        return {"success": True, "streams": streams}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))