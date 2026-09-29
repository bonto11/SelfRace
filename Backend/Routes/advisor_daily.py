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


class ManualStrengthExercise(BaseModel):
    exercise_id: str = Field(..., description="ID cviku z katalógu (Configs/strength_catalog.py)")
    sets: int = Field(..., ge=1, le=20)
    reps: str = Field(..., min_length=1, max_length=20, description="Napr. '8-12' alebo '5'")


class ManualDailySessionCreate(BaseModel):
    plan_date: str = Field(..., description="YYYY-MM-DD")
    sport: str = Field(..., description="'run' | 'ride' | 'swim' | 'strength' | 'other'")
    title: str = Field(..., min_length=1, max_length=200)
    duration_min: int = Field(..., ge=1, le=600)
    notes: Optional[str] = Field(None, max_length=1000)
    plan_meta_id: Optional[int] = Field(None, description="Ak nezadané, dohľadá sa aktívny plán usera")

    # run / ride / swim
    session_type: Optional[str] = Field(
        None, description="'easy' | 'recovery' | 'long' | 'tempo' | 'interval'"
    )
    structure_mode: Optional[str] = Field(None, description="'simple' | 'intervals'")
    warmup_min: Optional[int] = Field(None, ge=1, le=120)
    warmup_notes: Optional[str] = Field(None, max_length=300)
    cooldown_min: Optional[int] = Field(None, ge=1, le=120)
    cooldown_notes: Optional[str] = Field(None, max_length=300)
    main_minutes: Optional[int] = Field(None, ge=1, le=600)
    main_notes: Optional[str] = Field(None, max_length=300)
    rounds: Optional[int] = Field(None, ge=1, le=50)
    work_min: Optional[int] = Field(None, ge=1, le=120)
    work_notes: Optional[str] = Field(None, max_length=300)
    rest_min: Optional[int] = Field(None, ge=0, le=60)
    rest_notes: Optional[str] = Field(None, max_length=300)

    # strength
    exercises: Optional[List[ManualStrengthExercise]] = Field(None)


class ManualDailySessionUpdate(BaseModel):
    """
    Patch sémantika. title/duration_min/notes sa menia nezávisle. Ak je
    zadané `sport`, structure aj session_type sa prepočítajú celé nanovo.
    """
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    duration_min: Optional[int] = Field(None, ge=1, le=600)
    notes: Optional[str] = Field(None, max_length=1000)

    sport: Optional[str] = Field(None)
    session_type: Optional[str] = Field(None)
    structure_mode: Optional[str] = Field(None)
    warmup_min: Optional[int] = Field(None, ge=1, le=120)
    warmup_notes: Optional[str] = Field(None, max_length=300)
    cooldown_min: Optional[int] = Field(None, ge=1, le=120)
    cooldown_notes: Optional[str] = Field(None, max_length=300)
    main_minutes: Optional[int] = Field(None, ge=1, le=600)
    main_notes: Optional[str] = Field(None, max_length=300)
    rounds: Optional[int] = Field(None, ge=1, le=50)
    work_min: Optional[int] = Field(None, ge=1, le=120)
    work_notes: Optional[str] = Field(None, max_length=300)
    rest_min: Optional[int] = Field(None, ge=0, le=60)
    rest_notes: Optional[str] = Field(None, max_length=300)

    exercises: Optional[List[ManualStrengthExercise]] = Field(None)


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

        exercises_payload = (
            [e.model_dump() for e in payload.exercises] if payload.exercises else None
        )

        result = service_create_manual_daily_session(
            user_id=user_id,
            plan_date=payload.plan_date,
            sport=payload.sport,
            title=payload.title,
            duration_min=payload.duration_min,
            notes=payload.notes,
            plan_meta_id=payload.plan_meta_id,
            session_type=payload.session_type,
            structure_mode=payload.structure_mode,
            warmup_min=payload.warmup_min,
            warmup_notes=payload.warmup_notes,
            cooldown_min=payload.cooldown_min,
            cooldown_notes=payload.cooldown_notes,
            main_minutes=payload.main_minutes,
            main_notes=payload.main_notes,
            rounds=payload.rounds,
            work_min=payload.work_min,
            work_notes=payload.work_notes,
            rest_min=payload.rest_min,
            rest_notes=payload.rest_notes,
            exercises=exercises_payload,
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

        exercises_payload = (
            [e.model_dump() for e in payload.exercises] if payload.exercises else None
        )

        result = service_update_manual_daily_session(
            user_id=user_id,
            session_id=session_id,
            title=payload.title,
            duration_min=payload.duration_min,
            notes=payload.notes,
            sport=payload.sport,
            session_type=payload.session_type,
            structure_mode=payload.structure_mode,
            warmup_min=payload.warmup_min,
            warmup_notes=payload.warmup_notes,
            cooldown_min=payload.cooldown_min,
            cooldown_notes=payload.cooldown_notes,
            main_minutes=payload.main_minutes,
            main_notes=payload.main_notes,
            rounds=payload.rounds,
            work_min=payload.work_min,
            work_notes=payload.work_notes,
            rest_min=payload.rest_min,
            rest_notes=payload.rest_notes,
            exercises=exercises_payload,
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