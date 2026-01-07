# Routes_FE/maintenance.py

from __future__ import annotations

from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse

from Services.maintenance import (
    service_cleanup_deleted_activities,
    service_weekly_athlete_state_analysis,
)
from Configs.config import MAINTENANCE_API_KEY

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _check_api_key(x_api_key: str | None) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )


@router.post("/cleanup-deleted-activities")
async def cleanup_deleted_activities_endpoint(
    cutoff_days: int = Body(30, embed=True),
    x_api_key: str | None = Header(default=None),
):
    _check_api_key(x_api_key)

    try:
        result = service_cleanup_deleted_activities(cutoff_days=cutoff_days)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(e)},
            status_code=500,
        )


@router.post("/weekly-athlete-state")
async def weekly_athlete_state_endpoint(
    max_users: int = Body(500, embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Cron / manuálny endpoint – enqueuje ai_analyze job pre všetkých userov.
    """
    _check_api_key(x_api_key)

    try:
        result = service_weekly_athlete_state_analysis(max_users=max_users)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(e)},
            status_code=500,
        )