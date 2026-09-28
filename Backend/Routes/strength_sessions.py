# Routes/strength_sessions.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from Services.strength_sessions import (
    service_create_strength_session,
    service_get_strength_session,
    service_get_by_plan_session,
    service_get_by_activity,
    service_list_strength_sessions,
    service_update_strength_session,
    service_delete_strength_session,
    service_get_exercise_progression,
    service_list_planned_strength_sessions,
    service_import_from_plan,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/strength-sessions", tags=["strength-sessions"])

# ⚠️ PORADIE ROUTOV JE DÔLEŽITÉ
# FastAPI skúša routy v poradí deklarácie a berie prvú, ktorej cesta sedí.
# Generická "/{user_id}/{session_id}" sedí aj na "/{user_id}/planned-sessions"
# a "/{user_id}/by-activity/..." - keďže session_id je int, konverzia zlyhá
# a vráti sa 422 namiesto toho, aby sa skúsila správna routa. Preto musia byť
# VŠETKY konkrétne cesty (by-plan, by-activity, progression, planned-sessions)
# deklarované PRED generickou "/{user_id}/{session_id}".


class CreateStrengthSessionPayload(BaseModel):
    session_date: Optional[str] = None
    title: Optional[str] = None
    plan_session_id: Optional[int] = None
    activity_id: Optional[int] = None


class ImportFromPlanPayload(BaseModel):
    plan_session_id: int


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


# ─── KONKRÉTNE CESTY (musia byť pred /{user_id}/{session_id}) ───


@router.get("/{user_id}/by-plan/{plan_session_id}")
def get_by_plan_session(
    req: Request, user_id: int, plan_session_id: int
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_by_plan_session(
            user_id=user_id, plan_session_id=plan_session_id, ctx=ctx
        )
        return {"success": True, "data": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/by-activity/{activity_id}")
def get_by_activity(req: Request, user_id: int, activity_id: int) -> Dict[str, Any]:
    """
    🌟 NOVÉ: zápis silového tréningu naviazaný na Strava aktivitu.

    Väzbu vytvára service_match_strength_session_to_activity pri importe
    aktivity. Detail aktivity vďaka tomu vie ukázať, čo sa reálne odcvičilo
    (objem, série, najťažšia séria). Chýbajúci zápis nie je chyba - vráti
    sa data: null a FE sekciu jednoducho nevykreslí.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_by_activity(user_id=user_id, activity_id=activity_id, ctx=ctx)
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


@router.get("/{user_id}/planned-sessions")
def list_planned_sessions(
    req: Request, user_id: int, days_back: int = 14, days_forward: int = 7
) -> Dict[str, Any]:
    """
    ⚠️ PRESUNUTÉ VYŠŠIE: predtým bola táto routa deklarovaná až ZA
    "/{user_id}/{session_id}", takže požiadavka na /planned-sessions spadla
    do generickej routy a skončila na 422 (session_id: int neprijme
    "planned-sessions").
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        rows = service_list_planned_strength_sessions(
            user_id=user_id, days_back=days_back, days_forward=days_forward, ctx=ctx
        )
        return {"success": True, "data": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ─── GENERICKÉ CESTY S {session_id} ───


@router.get("/{user_id}/{session_id}")
def get_strength_session(req: Request, user_id: int, session_id: int) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        row = service_get_strength_session(
            user_id=user_id, session_id=session_id, ctx=ctx
        )
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
def delete_strength_session(
    req: Request, user_id: int, session_id: int
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_delete_strength_session(
            user_id=user_id, session_id=session_id, ctx=ctx
        )
        return {"success": bool(result.get("ok")), "error_code": result.get("code")}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/{session_id}/import-from-plan")
def import_from_plan(
    req: Request, user_id: int, session_id: int, payload: ImportFromPlanPayload
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        result = service_import_from_plan(
            user_id=user_id,
            session_id=session_id,
            plan_session_id=payload.plan_session_id,
            ctx=ctx,
        )
        if not result.get("ok"):
            return {"success": False, "error_code": result.get("code"), "data": None}
        return {"success": True, "data": result["data"]}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
