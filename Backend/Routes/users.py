from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from Services.users import (
    service_resolve_user,
    service_get_display_name,
    service_set_display_name,
    service_mark_app_seen,
)
from Schemas.users import ResolveIn
from Modules.Supabase.auth import get_auth_ctx, require_user, service_ctx
from Modules.Supabase.ownership import is_owner

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/resolve")
def resolve_user(
    req: Request,
    payload: ResolveIn,
):
    """
    POST /users/resolve
    Body: { "auth_uid": "..."} alebo { "supabase_uid": "..." }

    Response:
      - { "success": false, "error": "User not found in DB" }
      - { "success": true, "user_id": <int> }
    """
    ctx = require_user(get_auth_ctx(req))
    
    uid = payload.auth_uid or payload.supabase_uid
    if not uid:
        raise HTTPException(status_code=400, detail="Missing auth_uid")

    user_id = service_resolve_user(auth_uid=uid, ctx=ctx)
    if user_id is None:
        return {"success": False, "error": "User not found in DB"}

    return {"success": True, "user_id": user_id}


class DisplayNameIn(BaseModel):
    display_name: str = Field(..., max_length=100)

    model_config = ConfigDict(extra="forbid")


def _owner_service_ctx(req: Request, user_id: int, caller: str):
    # zápis do users ide cez service role (RLS na users update nepočíta),
    # preto explicitne overíme, že user_id patrí JWT
    ctx = require_user(get_auth_ctx(req))
    if not is_owner(ctx, user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    return service_ctx(caller)


@router.get("/{user_id}/name")
def get_display_name(req: Request, user_id: int) -> Dict[str, Any]:
    ctx = _owner_service_ctx(req, user_id, "users.get_display_name")
    res = service_get_display_name(user_id, ctx=ctx)
    return {"success": True, "display_name": res.get("display_name") or ""}


@router.put("/{user_id}/name")
def put_display_name(req: Request, user_id: int, payload: DisplayNameIn) -> Dict[str, Any]:
    ctx = _owner_service_ctx(req, user_id, "users.put_display_name")
    res = service_set_display_name(user_id, payload.display_name, ctx=ctx)
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code")}
    return {"success": True, "display_name": res.get("display_name")}


class AppSeenIn(BaseModel):
    standalone: bool = False
    platform: str = Field("desktop", max_length=20)

    model_config = ConfigDict(extra="forbid")


@router.post("/{user_id}/seen")
def post_app_seen(req: Request, user_id: int, payload: AppSeenIn) -> Dict[str, Any]:
    """Otvorenie appky (admin prehľad). Zápis do vlastných prefs pod RLS – cudzí user_id RLS odmietne."""
    ctx = require_user(get_auth_ctx(req))
    res = service_mark_app_seen(user_id, payload.standalone, payload.platform, ctx=ctx)
    return {"success": bool(res.get("ok"))}

