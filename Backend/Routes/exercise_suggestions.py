# Routes/exercise_suggestions.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from Services.exercise_suggestions import (
    service_create_exercise_suggestion,
    service_list_exercise_suggestions,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/exercise-suggestions", tags=["exercise-suggestions"])


class CreateExerciseSuggestionPayload(BaseModel):
    name: str
    pattern: Optional[str] = None
    load_mode: Optional[str] = None
    measure: Optional[str] = None
    equipment: Optional[List[str]] = None
    notes: Optional[str] = None


@router.post("/{user_id}")
def create_exercise_suggestion(
    req: Request, user_id: int, payload: CreateExerciseSuggestionPayload
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_create_exercise_suggestion(
            user_id=user_id,
            name=payload.name,
            pattern=payload.pattern,
            load_mode=payload.load_mode,
            measure=payload.measure,
            equipment=payload.equipment,
            notes=payload.notes,
            ctx=ctx,
        )
        if not result.get("ok"):
            return {"success": False, "error_code": result.get("code"), "data": None}
        return {"success": True, "data": result["data"]}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
def list_exercise_suggestions(req: Request, user_id: int, limit: int = 50) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        rows = service_list_exercise_suggestions(user_id=user_id, limit=limit, ctx=ctx)
        return {"success": True, "data": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
