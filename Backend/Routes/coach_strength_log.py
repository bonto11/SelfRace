# Routes/coach_strength_log.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from Services.coach_strength_log import (
    service_get_or_init_strength_log,
    service_save_strength_log,
    service_get_exercise_progression,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/coach-strength-log", tags=["coach-strength-log"])


class StrengthLogPayload(BaseModel):
    exercises: list = Field(default_factory=list)
    completed: bool = False
    session_note: str | None = None


@router.get("/{user_id}/{session_id}")
def get_strength_log(req: Request, user_id: int, session_id: int) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        log = service_get_or_init_strength_log(
            user_id=user_id, session_id=session_id, ctx=ctx
        )
        return {"success": True, "data": log}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/{session_id}")
def save_strength_log(
    req: Request, user_id: int, session_id: int, payload: StrengthLogPayload
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_save_strength_log(
            user_id=user_id,
            session_id=session_id,
            payload=payload.model_dump(),
            ctx=ctx,
        )
        if not result.get("ok"):
            return {"success": False, "error_code": result.get("code"), "data": None}
        return {"success": True, "data": result["data"]}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/progression/{exercise_id}")
def get_exercise_progression(
    req: Request, user_id: int, exercise_id: str, weeks_back: int = 8
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_exercise_progression(
            user_id=user_id, exercise_id=exercise_id, weeks_back=weeks_back, ctx=ctx
        )
        return {"success": True, "data": data}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))