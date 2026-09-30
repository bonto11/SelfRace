# Routes/exercise_suggestions.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from Services.exercise_suggestions import (
    service_create_exercise_suggestion,
    service_list_exercise_suggestions,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/exercise-suggestions", tags=["exercise-suggestions"])


class ExerciseSuggestionPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    # 🌟 ZMENA: user zadáva svalové partie, nie pohybový vzor. Vzor je
    # interná vec generátora - dopĺňa sa ručne pri schvaľovaní návrhu.
    muscles: Optional[List[str]] = Field(None, max_length=6)
    load_mode: Optional[str] = Field(None, description="external | bodyweight_plus")
    measure: Optional[str] = Field(None, description="reps | time | distance")
    equipment: Optional[List[str]] = Field(None, max_length=10)
    notes: Optional[str] = Field(None, max_length=500)


@router.post("/{user_id}")
def create_exercise_suggestion(
    req: Request, user_id: int, payload: ExerciseSuggestionPayload
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_create_exercise_suggestion(
            user_id=user_id,
            name=payload.name,
            muscles=payload.muscles,
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
def list_exercise_suggestions(
    req: Request, user_id: int, limit: int = 50
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        rows = service_list_exercise_suggestions(user_id=user_id, limit=limit, ctx=ctx)
        return {"success": True, "data": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))