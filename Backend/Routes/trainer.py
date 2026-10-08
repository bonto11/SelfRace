# Routes/trainer.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from Modules.Supabase.auth import AuthCtx, get_auth_ctx, require_user
from Modules.Supabase.ownership import is_owner
from Services.trainer_links import (
    service_end_trainer_link,
    service_get_trainer_overview,
    service_regenerate_share_code,
    service_request_athlete_by_code,
    service_respond_trainer_request,
)

router = APIRouter(prefix="/trainer", tags=["trainer"])


class TrainerRequestIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)

    model_config = ConfigDict(extra="forbid")


class TrainerRespondIn(BaseModel):
    accept: bool

    model_config = ConfigDict(extra="forbid")


def _owner_ctx(req: Request, user_id: int) -> AuthCtx:
    # Service pracuje cez service role (vzťah dvoch userov) – RLS tu nechráni,
    # preto explicitná kontrola, že user_id patrí JWT.
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    return ctx


def _out(res: Dict[str, Any]) -> Dict[str, Any]:
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "trainer_request_failed"}
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}


@router.get("/{user_id}/overview")
def get_trainer_overview(req: Request, user_id: int) -> Dict[str, Any]:
    _owner_ctx(req, user_id)
    return {"success": True, "data": service_get_trainer_overview(user_id)}


@router.post("/{user_id}/share-code/regenerate")
def post_regenerate_share_code(req: Request, user_id: int) -> Dict[str, Any]:
    _owner_ctx(req, user_id)
    return _out(service_regenerate_share_code(user_id))


@router.post("/{user_id}/requests")
def post_trainer_request(req: Request, user_id: int, payload: TrainerRequestIn) -> Dict[str, Any]:
    _owner_ctx(req, user_id)
    return _out(service_request_athlete_by_code(user_id, payload.code))


@router.post("/{user_id}/links/{link_id}/respond")
def post_trainer_respond(req: Request, user_id: int, link_id: int, payload: TrainerRespondIn) -> Dict[str, Any]:
    _owner_ctx(req, user_id)
    return _out(service_respond_trainer_request(user_id, link_id, payload.accept))


@router.post("/{user_id}/links/{link_id}/end")
def post_trainer_end(req: Request, user_id: int, link_id: int) -> Dict[str, Any]:
    _owner_ctx(req, user_id)
    return _out(service_end_trainer_link(user_id, link_id))
