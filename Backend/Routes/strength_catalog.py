# Routes/strength_catalog.py
"""
Katalóg silových cvikov z DB.

GET  /strength-catalog?v=<verzia>  – pre appku (prihlásený user); rovnaká verzia = bez položiek
/strength-catalog/admin/*          – admin panel (x-api-key): cviky, návrhy userov, AI asistent
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Header, HTTPException, Request, status

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.AI.catalog_assistant.main import service_catalog_assistant
from Services.exercise_suggestions import (
    service_admin_list_suggestions,
    service_admin_resolve_suggestion,
)
from Services.strength_catalog_store import (
    service_admin_list_exercises,
    service_admin_save_exercise,
    service_strength_catalog_for_fe,
)

router = APIRouter(prefix="/strength-catalog", tags=["strength-catalog"])


def _admin(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or missing API key")


def _out(res: Dict[str, Any]) -> Dict[str, Any]:
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "failed"}
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}


# statické cesty pred parametrickými
@router.get("/admin/exercises")
def admin_list_exercises(x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _admin(x_api_key)
    return _out(service_admin_list_exercises())


@router.put("/admin/exercises")
def admin_save_exercise(
    exercise: Dict[str, Any] = Body(..., embed=True),
    x_api_key: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _admin(x_api_key)
    return _out(service_admin_save_exercise(exercise))


@router.get("/admin/suggestions")
def admin_list_suggestions(
    status_filter: Optional[str] = None,
    x_api_key: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _admin(x_api_key)
    return _out(service_admin_list_suggestions(status=status_filter))


@router.post("/admin/suggestions/{suggestion_id}")
def admin_resolve_suggestion(
    suggestion_id: int,
    status_value: str = Body(..., embed=True, alias="status"),
    exercise_id: Optional[str] = Body(None, embed=True),
    notify: bool = Body(False, embed=True),
    message: Optional[str] = Body(None, embed=True),
    x_api_key: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _admin(x_api_key)
    return _out(service_admin_resolve_suggestion(
        suggestion_id, status=status_value, exercise_id=exercise_id, notify=notify, message=message,
    ))


@router.post("/admin/assistant")
def admin_assistant(
    messages: List[Dict[str, Any]] = Body(..., embed=True),
    exercise: Optional[Dict[str, Any]] = Body(None, embed=True),
    x_api_key: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    _admin(x_api_key)
    return _out(service_catalog_assistant(messages, exercise))


@router.get("")
def get_catalog(req: Request, v: Optional[str] = None) -> Dict[str, Any]:
    require_user(get_auth_ctx(req))
    return {"success": True, "data": service_strength_catalog_for_fe(v)}
