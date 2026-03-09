# Routes_FE/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from Schemas.coach_plan_weekly import WeeklyGenerateConfig
from Services.AI.weekly_plan.main import (
    service_generate_weekly_plan,
    service_get_latest_weekly_plan,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/coach-plan-weekly",
    tags=["coach-plan-weekly"],
)


@router.post("/generate/{user_id}")
def generate_weekly_plan(
    req: Request,
    user_id: int,
    payload: WeeklyGenerateConfig,
) -> Dict[str, Any]:
    """
    Vygeneruje / prepíše weekly plán pre daného usera.

    Volá Services.coach_plan_weekly.service_generate_weekly_plan.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_generate_weekly_plan(
            user_id=user_id,
            ctx=ctx,
            overwrite=payload.overwrite,
            state_id=payload.state_id,
            weeks=payload.weeks,
            model=payload.model,
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
    req: Request,
    user_id: int,
) -> Dict[str, Any]:
    """
    Vráti najnovší weekly plán pre daného usera (alebo None).

    Response:
      {
        "success": true,
        "plan": {
          "weeks": [ ... ]
        } | None
      }
    """

    try:
        ctx = require_user(get_auth_ctx(req))

        plan = service_get_latest_weekly_plan(
            user_id=user_id,
            ctx=ctx,
        )
        return {
            "success": True,
            "plan": plan,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
