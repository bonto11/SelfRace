# Routes_FE/synchronization.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict

from Schemas.synchronization import (
    SyncActivitiesRequest,
    SyncActivitiesResponse,
)
from Services.synchronization_bulk import service_sync_activities
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/synchronization", tags=["synchronization"])


@router.post("/{user_id}", response_model=SyncActivitiesResponse)
def sync_activities_endpoint(
    req: Request,
    user_id: int,
) -> Dict[str, Any]:
    """
    Spustí Strava sync pre daného usera.

    Body:
      - force_last_days: int | null (default 30)
      - fetch_details: bool (default True)

    JWT je povinné – sync je vždy user-scoped (RLS).
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        stats = service_sync_activities(
            user_id=user_id,
            ctx=ctx
        )
        return {
            "success": True,
            "stats": stats,
            "note": None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))