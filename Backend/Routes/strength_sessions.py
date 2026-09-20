# Routes/strength_sessions.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from Services.strength_sessions import (
    service_create_strength_session,
    service_get_strength_session,
    service_get_by_plan_session,
    service_list_strength_sessions,
    service_update_strength_session,
    service_delete_strength_session,
    service_get_exercise_progression,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/strength-sessions", tags=["strength-sessions"])


class CreateStrengthSessionPayload(BaseModel):
    session_date: Optional[str] = None
    title: Optional[str] = None
    plan_session_id: Optional[int] = None
    activity_id: Optional[int] = None


class UpdateStrengthSessionPayload(BaseModel):
    exercises: Optional[List[Dict[str, Any]]] = None
    completed: Optional[bool] = None
    session_note: Optional[str] = None
    session_date: Optional[str] = None
    title: Optional[str] = None


@router.post("/{user_id}")
def create_strength_session(
    req: Request, user_id: int, payload: CreateStrengthSessionPayload
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_create_strength_session(
            user_id=user_id,
            session_date=payload.session_date,
            title=payload.title,
            plan_session_id=payload.plan_session_id,
            activity_id=payload.activity_id,
            ctx=ctx,
        )
        if not result.get("ok"):
            return {"success": False, "error_code": result.get("code"), "data": None}
        return {"success": True, "data": result["data"], "note": result.get("note")}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
def list_strength_sessions(
    req: Request, user_id: int, weeks_back: int = 12, limit: int = 100
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        rows = service_list_strength_sessions(
            user_id=user_id, weeks_back=weeks_back, limit=limit, ctx=ctx
        )
        return {"success": True, "data": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/by-plan/{plan_session_id}")
def get_by_plan_session(req: Request, user_id: int, plan_session_id: int) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_by_plan_session(
            user_id=user_id, plan_session_id=plan_session_id, ctx=ctx
        )
        return {"success": True, "data": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/progression/{exercise_id}")
def get_exercise_progression(
    req: Request, user_id: int, exercise_id: str, weeks_back: int = 12
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_exercise_progression(
            user_id=user_id, exercise_id=exercise_id, weeks_back=weeks_back, ctx=ctx
        )
        return {"success": True, "data": data}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/{session_id}")
def get_strength_session(req: Request, user_id: int, session_id: int) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_strength_session(user_id=user_id, session_id=session_id, ctx=ctx)
        if not row:
            return {"success": False, "error_code": "NOT_FOUND", "data": None}
        return {"success": True, "data": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/{session_id}")
def update_strength_session(
    req: Request, user_id: int, session_id: int, payload: UpdateStrengthSessionPayload
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_update_strength_session(
            user_id=user_id,
            session_id=session_id,
            exercises=payload.exercises,
            completed=payload.completed,
            session_note=payload.session_note,
            session_date=payload.session_date,
            title=payload.title,
            ctx=ctx,
        )
        if not result.get("ok"):
            return {"success": False, "error_code": result.get("code"), "data": None}
        return {"success": True, "data": result["data"]}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/{session_id}")
def delete_strength_session(req: Request, user_id: int, session_id: int) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_delete_strength_session(
            user_id=user_id, session_id=session_id, ctx=ctx
        )
        return {"success": bool(result.get("ok")), "error_code": result.get("code")}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))