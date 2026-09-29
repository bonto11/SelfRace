# Routes/advisor_daily.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from Services.coach_plan_daily_manual import (
    service_create_manual_daily_session,
    service_update_manual_daily_session,
    service_delete_manual_daily_session,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/advisor-daily",
    tags=["advisor-daily"],
)

# Polia, ktoré NIE sú súčasťou structure_input (idú ako samostatné parametre)
BASE_FIELDS = {"plan_date", "sport", "title", "duration_min", "notes", "plan_meta_id"}


class ManualStrengthExercise(BaseModel):
    exercise_id: str = Field(..., description="ID cviku z katalógu (Configs/strength_catalog.py)")
    sets: int = Field(..., ge=1, le=20)
    reps: str = Field(..., min_length=1, max_length=20, description="Napr. '8-12' alebo '5'")


class ManualStructureFields(BaseModel):
    """Spoločné štruktúrne polia pre create aj update."""

    # run / ride / swim
    session_type: Optional[str] = Field(None, description="'easy' | 'recovery' | 'long' | 'tempo' | 'interval'")
    structure_mode: Optional[str] = Field(None, description="'simple' | 'intervals'")
    warmup_min: Optional[int] = Field(None, ge=0, le=120)
    warmup_notes: Optional[str] = Field(None, max_length=300)
    cooldown_min: Optional[int] = Field(None, ge=0, le=120)
    cooldown_notes: Optional[str] = Field(None, max_length=300)
    main_minutes: Optional[int] = Field(None, ge=1, le=600)
    main_notes: Optional[str] = Field(None, max_length=300)

    # intervaly - 🌟 úsek/pauza na čas (sekundy) alebo vzdialenosť (metre)
    rounds: Optional[int] = Field(None, ge=1, le=50)
    work_unit: Optional[str] = Field(None, description="'time' | 'distance'")
    work_duration_s: Optional[int] = Field(None, ge=5, le=7200)
    work_distance_m: Optional[int] = Field(None, ge=50, le=50000)
    work_notes: Optional[str] = Field(None, max_length=300)
    rest_unit: Optional[str] = Field(None, description="'time' | 'distance'")
    rest_duration_s: Optional[int] = Field(None, ge=0, le=3600)
    rest_distance_m: Optional[int] = Field(None, ge=0, le=10000)
    rest_notes: Optional[str] = Field(None, max_length=300)

    # legacy (staršie FE) - backend ich prepočíta na sekundy
    work_min: Optional[int] = Field(None, ge=1, le=120)
    rest_min: Optional[int] = Field(None, ge=0, le=60)

    # strength
    exercises: Optional[List[ManualStrengthExercise]] = Field(None)


class ManualDailySessionCreate(ManualStructureFields):
    plan_date: str = Field(..., description="YYYY-MM-DD")
    sport: str = Field(..., description="'run' | 'ride' | 'swim' | 'strength' | 'other'")
    title: str = Field(..., min_length=1, max_length=200)
    duration_min: int = Field(..., ge=1, le=600)
    notes: Optional[str] = Field(None, max_length=1000)
    plan_meta_id: Optional[int] = Field(None, description="Ak nezadané, dohľadá sa aktívny plán usera")


class ManualDailySessionUpdate(ManualStructureFields):
    """
    Patch sémantika. title/duration_min/notes sa menia nezávisle. Ak je
    zadané `sport`, structure aj session_type sa prepočítajú celé nanovo.
    """
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    duration_min: Optional[int] = Field(None, ge=1, le=600)
    notes: Optional[str] = Field(None, max_length=1000)
    sport: Optional[str] = Field(None)


def _structure_input(payload: BaseModel) -> Dict[str, Any]:
    return payload.model_dump(exclude=BASE_FIELDS, exclude_none=True)


def _fail(result: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "error_code": result.get("code") or "REQUEST_FAILED",
        "message": result.get("message"),
    }


@router.post("/session/{user_id}")
def create_manual_daily_session(
    req: Request,
    user_id: int,
    payload: ManualDailySessionCreate,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_create_manual_daily_session(
            user_id=user_id,
            plan_date=payload.plan_date,
            sport=payload.sport,
            title=payload.title,
            duration_min=payload.duration_min,
            notes=payload.notes,
            plan_meta_id=payload.plan_meta_id,
            structure_input=_structure_input(payload),
            ctx=ctx,
        )

        if not result.get("ok"):
            return _fail(result)

        return {"success": True, "data": result["data"], "error_code": None, "message": None}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/session/{user_id}/{session_id}")
def update_manual_daily_session(
    req: Request,
    user_id: int,
    session_id: int,
    payload: ManualDailySessionUpdate,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_update_manual_daily_session(
            user_id=user_id,
            session_id=session_id,
            title=payload.title,
            duration_min=payload.duration_min,
            notes=payload.notes,
            sport=payload.sport,
            structure_input=_structure_input(payload),
            ctx=ctx,
        )

        if not result.get("ok"):
            return _fail(result)

        return {"success": True, "data": result["data"], "error_code": None, "message": None}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{user_id}/{session_id}")
def delete_manual_daily_session(
    req: Request,
    user_id: int,
    session_id: int,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        result = service_delete_manual_daily_session(
            user_id=user_id, session_id=session_id, ctx=ctx
        )

        if not result.get("ok"):
            return _fail(result)

        return {"success": True, "data": result["data"], "error_code": None, "message": None}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
