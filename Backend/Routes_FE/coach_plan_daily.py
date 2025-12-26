# Routes_FE/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Depends

from Configs.config import COACH_PLAN_OVERVIEW_HORIZON_DAYS
from Schemas.coach_plan_daily import DailyWeekGenerateConfig
from Services.coach_plan_daily import (
    service_generate_daily_week,
    service_get_daily_overview,
)
from Modules.Auth.deps import require_user_jwt

router = APIRouter(
    prefix="/coach-plan-daily",
    tags=["coach-plan-daily"],
)


@router.post("/generate/{user_id}")
def generate_daily_for_week(
    user_id: int,
    payload: DailyWeekGenerateConfig,
    user_jwt: str = Depends(require_user_jwt),
) -> Dict[str, Any]:
    """
    Vygeneruje / prepíše daily plán pre konkrétny týždeň.
    """
    try:
        result = service_generate_daily_week(
            user_id=user_id,
            week_index=payload.week_index,
            plan_id=payload.plan_id,
            overwrite=payload.overwrite,
            model=payload.model,
            debug=payload.debug,
            user_jwt=user_jwt,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview/{user_id}")
def get_daily_overview(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
) -> Dict[str, Any]:
    """
    Vráti jednoduchý prehľad daily plánu pre najbližšie dni.
    """
    try:
        overview = service_get_daily_overview(
            user_id=user_id,
            horizon_days=COACH_PLAN_OVERVIEW_HORIZON_DAYS,
            user_jwt=user_jwt,
        )
        return {
            "success": True,
            "overview": overview,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))