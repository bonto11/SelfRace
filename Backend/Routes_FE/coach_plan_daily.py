# Routes_FE/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from Schemas.coach_plan_daily import DailyWeekGenerateConfig
from Services.coach_plan_daily import service_generate_daily_week

router = APIRouter(
    prefix="/coach-plan-daily",
    tags=["coach-plan-daily"],
)


@router.post("/generate/{user_id}")
def generate_daily_for_week(
    user_id: int,
    payload: DailyWeekGenerateConfig,
) -> Dict[str, Any]:
    """
    Vygeneruje / prepíše daily plán pre konkrétny týždeň.

    Volá Services.coach_plan_daily.service_generate_daily_week.
    """
    try:
        result = service_generate_daily_week(
            user_id=user_id,
            week_index=payload.week_index,
            plan_id=payload.plan_id,
            overwrite=payload.overwrite,
            model=payload.model,
            debug=payload.debug,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))