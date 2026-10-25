# Routes/season_plan.py
"""Plán obdobia (kostra na viac týždňov, advisor) – za prepínačom season_plan."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from Modules.Supabase.auth import get_auth_ctx, require_user
from Modules.Supabase.ownership import caller_user_id
from Services.AI.season_plan.main import service_season_plan_suggest
from Services.features import service_feature_enabled
from Services.season_plan import (
    MAX_WEEKS,
    MIN_WEEKS,
    service_delete_season_plan,
    service_get_season_plan,
    service_save_season_plan,
)

router = APIRouter(prefix="/season-plan", tags=["season-plan"])

FEATURE = "season_plan"


class SuggestIn(BaseModel):
    start_date: str = Field(..., min_length=10, max_length=10, description="YYYY-MM-DD")
    weeks: int = Field(8, ge=MIN_WEEKS, le=MAX_WEEKS)
    request: Optional[str] = Field(None, max_length=1500)
    # predošlé kolá z FE: {role: user, text} / {role: assistant, reply_text}
    thread: List[Dict[str, Any]] = Field(default_factory=list, max_length=8)
    # plán, ktorý sa má upraviť (uložený alebo posledný návrh)
    current_plan: Optional[Dict[str, Any]] = None


class SaveIn(BaseModel):
    plan: Dict[str, Any]


def _guard(req: Request, user_id: int, *, write: bool):
    ctx = require_user(get_auth_ctx(req))
    caller = caller_user_id(ctx)
    if not service_feature_enabled(caller, FEATURE):
        return ctx, {"success": False, "error_code": "feature_disabled"}
    # PREČO zápis len vlastník: kostra je jeho plán; tréner ju len číta (RLS)
    if write and caller != int(user_id):
        return ctx, {"success": False, "error_code": "forbidden"}
    return ctx, None


@router.get("/{user_id}")
def get_season_plan(req: Request, user_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, write=False)
    if err:
        return err
    return {"success": True, "data": {"plan": service_get_season_plan(int(user_id), ctx=ctx)}}


@router.post("/{user_id}/suggest")
def post_season_plan_suggest(req: Request, user_id: int, payload: SuggestIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, write=True)
    if err:
        return err
    res = service_season_plan_suggest(
        user_id=int(user_id),
        start_date=payload.start_date,
        weeks=payload.weeks,
        request=payload.request,
        thread=payload.thread,
        current_plan=payload.current_plan,
        ctx=ctx,
    )
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "ai_generation_failed"}
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}


@router.put("/{user_id}")
def put_season_plan(req: Request, user_id: int, payload: SaveIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, write=True)
    if err:
        return err
    res = service_save_season_plan(int(user_id), payload.plan, ctx=ctx)
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "save_failed"}
    return {"success": True, "data": {"plan": res["plan"]}}


@router.delete("/{user_id}")
def delete_season_plan(req: Request, user_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, write=True)
    if err:
        return err
    res = service_delete_season_plan(int(user_id), ctx=ctx)
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "save_failed"}
    return {"success": True}
