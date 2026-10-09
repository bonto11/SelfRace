# Routes/session_messages.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.session_messages import (
    MAX_BODY_LEN,
    service_get_thread,
    service_list_unread,
    service_post_message,
)

# user_id v ceste = zverenec (vlastník tréningu). Či volajúci smie, overí
# service (atlét sám alebo jeho aktívny tréner) – tabuľka je bez RLS policies.
router = APIRouter(prefix="/session-messages", tags=["session-messages"])


class SessionMessageIn(BaseModel):
    plan_id: Optional[int] = Field(None, ge=1)
    activity_id: Optional[int] = Field(None, ge=1)
    body: str = Field(..., min_length=1, max_length=MAX_BODY_LEN)

    model_config = ConfigDict(extra="forbid")


@router.get("/{user_id}/thread")
def get_thread(
    req: Request,
    user_id: int,
    plan_id: Optional[int] = None,
    activity_id: Optional[int] = None,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    data = service_get_thread(ctx, user_id, plan_id=plan_id, activity_id=activity_id)
    return {"success": True, "data": data}


@router.post("/{user_id}/thread")
def post_message(req: Request, user_id: int, payload: SessionMessageIn) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    res = service_post_message(
        ctx, user_id, plan_id=payload.plan_id, activity_id=payload.activity_id, body=payload.body
    )
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "thread_send_failed"}
    return {"success": True, "data": res.get("message")}


@router.get("/{user_id}/unread")
def get_unread(req: Request, user_id: int) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    return {"success": True, "data": service_list_unread(ctx, user_id)}
