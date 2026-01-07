# Routes_FE/synchronization.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from typing import Any, Dict

from Schemas.synchronization import (
    SyncActivitiesRequest,
    SyncActivitiesResponse,
)
from Services.synchronization import service_sync_activities
from Modules.HTTP.auth_deps import require_user_jwt

router = APIRouter(prefix="/synchronization", tags=["synchronization"])


@router.post("/{user_id}", response_model=SyncActivitiesResponse)
def sync_activities_endpoint(
    user_id: int,
    payload: SyncActivitiesRequest,
    user_jwt: str = Depends(require_user_jwt),
) -> Dict[str, Any]:
    """
    Spustí Strava sync pre daného usera.

    Body:
      - force_last_days: int | null (default 30)
      - fetch_details: bool (default True)

    JWT je povinné – sync je vždy user-scoped (RLS).
    """
    try:
        stats = service_sync_activities(
            user_id=user_id,
            force_last_days=payload.force_last_days,
            fetch_details=payload.fetch_details,
            user_jwt=user_jwt,
        )
        return {
            "success": True,
            "stats": stats,
            "note": None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))