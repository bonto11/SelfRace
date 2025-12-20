# backend/Routes_FE/analytics_weekly.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Any, Dict

from Services.analytics_weekly import service_weekly_analytics
from Schemas.analytics import WeeklyAnalyticsResponse

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/weekly/{user_id}", response_model=WeeklyAnalyticsResponse,)
def weekly(
    user_id: int,
    weeks: int = 12,
) -> Dict[str, Any]:
    """
    Týždenná agregácia za posledných N týždňov.
    (km/time/TRIMP + Monotony/Strain + hr_used)
    """
    try:
        payload = service_weekly_analytics(user_id=user_id, weeks=weeks)
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        print(f"[ANALYTICS] weekly failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))