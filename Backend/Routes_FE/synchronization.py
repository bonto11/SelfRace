from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from Schemas.synchronization import (
    SyncActivitiesRequest,
    SyncActivitiesResponse,
)
from Services.synchronization import service_sync_activities

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/activities/{user_id}", response_model=SyncActivitiesResponse)
def sync_activities_endpoint(
    user_id: int,
    payload: SyncActivitiesRequest,
) -> Dict[str, Any]:
    """
    Manuálne spustenie syncu zo Stravy pre daného usera.
    """
    try:
        stats = service_sync_activities(
            user_id=user_id,
            force_last_days=payload.force_last_days,
            fetch_details=payload.fetch_details,
        )
        return {
            "success": True,
            "stats": stats,
            "note": None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))