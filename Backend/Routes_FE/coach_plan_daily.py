# Routes_FE/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Depends, Request

from Configs.config import COACH_PLAN_OVERVIEW_HORIZON_DAYS
from Schemas.coach_plan_daily import DailyWeekGenerateConfig
from Services.AI.daily_plan import (
    service_generate_daily_week,
    service_get_daily_overview,
)
from Modules.HTTP.auth_deps import require_user_jwt
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/coach-plan-daily",
    tags=["coach-plan-daily"],
)


@router.post("/generate/{user_id}")
def generate_daily_for_week(
    req: Request,
    user_id: int,
    payload: DailyWeekGenerateConfig,
) -> Dict[str, Any]:
    """
    Vygeneruje / prepíše daily plán pre konkrétny týždeň.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_generate_daily_week(
            user_id=user_id,
            week_index=payload.week_index,
            plan_id=payload.plan_id,
            model=payload.model,
            ctx=ctx,
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
    req: Request,
    user_id: int,
) -> Dict[str, Any]:
    """
    Vráti jednoduchý prehľad daily plánu pre najbližšie dni.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        overview = service_get_daily_overview(
            user_id=user_id,
            horizon_days=COACH_PLAN_OVERVIEW_HORIZON_DAYS,
            ctx=ctx,
        )
        return {
            "success": True,
            "overview": overview,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
