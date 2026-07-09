# Routes_FE/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from Configs.config import COACH_PLAN_OVERVIEW_HORIZON_DAYS
from pydantic import BaseModel, Field
from Services.coach_plan_adjustment import service_reschedule_daily_plan

from Schemas.coach_plan_daily import DailyWeekGenerateConfig
from Services.AI.daily_plan.main import (
    service_generate_daily_week,
    service_get_daily_overview,
    service_update_daily_session_status,
)


from DB.coach_plan_daily import db_get_compliance_stats, db_get_postponed_sessions, db_get_unmatched_activities
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/coach-plan-daily",
    tags=["coach-plan-daily"],
)


class DailySessionPatch(BaseModel):
    status: Optional[str] = Field(
        None, description="Napr. 'planned', 'postponed', 'missed'"
    )
    activity_id: Optional[int] = Field(
        None, description="ID aktivity pre manuálne spárovanie"
    )
    unmatch: Optional[bool] = Field(
        False, description="Ak True, zruší spárovanie a vráti stav na planned"
    )


@router.post("/generate/{user_id}")
def generate_daily_for_week(
    req: Request,
    user_id: int,
    payload: DailyWeekGenerateConfig,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_generate_daily_week(
            user_id=user_id,
            week_index=payload.week_index,
            model=payload.model,
            ctx=ctx,
        )

        # ✅ Skontrolujeme vnútorné "ok" z workera
        if not result.get("ok"):
            return {
                "success": False,
                "data": None,
                "error_code": result.get("code") or "REQUEST_FAILED",
                "message": result.get("message"),
            }

        return {"success": True, "data": result, "error_code": None, "message": None}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview/{user_id}")
def get_daily_overview(
    req: Request,
    user_id: int,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        overview = service_get_daily_overview(
            user_id=user_id,
            horizon_days=COACH_PLAN_OVERVIEW_HORIZON_DAYS,
            ctx=ctx,
        )

        return {"success": True, "data": overview, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DailyRescheduleMove(BaseModel):
    id: int = Field(..., description="PK id z coach_plan_daily")
    from_date: str = Field(..., description="YYYY-MM-DD (len pre audit/validáciu)")
    to_date: str = Field(..., description="YYYY-MM-DD")


class DailyReschedulePayload(BaseModel):
    moves: list[DailyRescheduleMove] = Field(default_factory=list)


@router.post("/reschedule/{user_id}")
def reschedule_daily_plan(
    req: Request,
    user_id: int,
    payload: DailyReschedulePayload,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        overview = service_reschedule_daily_plan(
            user_id=user_id,
            moves=[m.model_dump() for m in (payload.moves or [])],
            horizon_days=COACH_PLAN_OVERVIEW_HORIZON_DAYS,
            ctx=ctx,
        )

        return {"success": True, "data": overview, "error_code": None, "message": None}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/session/{user_id}/{session_id}")
def update_daily_session_status_route(
    req: Request,
    user_id: int,
    session_id: int,
    payload: DailySessionPatch,
) -> Dict[str, Any]:
    """
    Univerzálny endpoint pre manuálne zásahy do tréningu z Frontendu.
    Presúva logiku do service vrstvy.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        # Všetka logika sa deje v Service
        result = service_update_daily_session_status(
            user_id=user_id,
            session_id=session_id,
            status=payload.status,
            activity_id=payload.activity_id,
            unmatch=bool(payload.unmatch),
            ctx=ctx,
        )

        return {
            "success": True,
            "data": result["data"],
            "error_code": None,
            "message": result["message"],
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/compliance/{user_id}")
def get_plan_compliance(req: Request, user_id: int) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        stats = db_get_compliance_stats(user_id, days=30, ctx=ctx)
        postponed = db_get_postponed_sessions(user_id, ctx=ctx)
        unmatched_summary = db_get_unmatched_activities_summary(user_id, days=30, ctx=ctx)

        return {
            "success": True,
            "data": {
                "stats": stats,
                "postponed_sessions": postponed,
                "unmatched_summary": unmatched_summary,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

