# backend/Routes_FE/synchronization.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Header
from typing import Any, Dict, List, Optional

from Schemas.synchronization import (
    SyncActivitiesRequest,
    SyncActivitiesResponse,
)
from Services.synchronization import service_sync_activities

router = APIRouter(prefix="/synchronization", tags=["synchronization"])


def _extract_user_jwt(authorization: Optional[str]) -> Optional[str]:
    """
    Vytiahne Bearer token z Authorization headeru.
    Očakáva tvar: "Bearer <jwt>".
    Ak nie je, vráti None – services/DB si poradia (napr. service-role client).
    """
    if not authorization:
        return None
    try:
        prefix, token = authorization.split(" ", 1)
        if prefix.lower() != "bearer":
            return None
        token = token.strip()
        return token or None
    except Exception:
        return None


@router.post("/{user_id}", response_model=SyncActivitiesResponse)
def sync_activities_endpoint(
    user_id: int,
    payload: SyncActivitiesRequest,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Spustí Strava sync pre daného usera.
    Body:
      - force_last_days: int | null (default 30)
      - fetch_details: bool (default True)
    """
    user_jwt = _extract_user_jwt(authorization)

    try:
        stats = service_sync_activities(
            user_id=user_id,
            force_last_days=payload.force_last_days,
            fetch_details=payload.fetch_details,
            user_jwt=user_jwt,  # 🔹 RLS / JWT path
        )
        return {
            "success": True,
            "stats": stats,
            "note": None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))