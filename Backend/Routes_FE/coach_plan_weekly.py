# Routes_FE/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from Schemas.coach_plan_weekly import WeeklyGenerateConfig
from Services.coach_plan_weekly import (
    service_generate_weekly_plan,
    service_get_latest_weekly_plan,  # ← PRIDANÉ
)
router = APIRouter(
    prefix="/coach-plan-weekly",
    tags=["coach-plan-weekly"],
)


@router.post("/generate/{user_id}")
def generate_weekly_plan(
    user_id: int,
    payload: WeeklyGenerateConfig,
) -> Dict[str, Any]:
    """
    Vygeneruje / prepíše weekly plán pre daného usera.

    Volá Services.coach_plan_weekly.service_generate_weekly_plan.
    """
    try:
        result = service_generate_weekly_plan(
            user_id=user_id,
            overwrite=payload.overwrite,
            state_id=payload.state_id,
            weeks=payload.weeks,
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
        
@router.get("/latest/{user_id}")
def get_latest_weekly_plan(
    user_id: int,
) -> Dict[str, Any]:
    """
    Vráti najnovší weekly plán pre daného usera (alebo None).

    Response:
      {
        "success": true,
        "plan": {
          "plan_id": "...",
          "weeks": [ ... ]
        } | None
      }
    """
    try:
        plan = service_get_latest_weekly_plan(user_id=user_id)
        return {
            "success": True,
            "plan": plan,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))