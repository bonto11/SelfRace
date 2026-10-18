# Routes/admin_outreach.py
"""Admin endpointy pre pripomienkové e-maily (admin panel, x-api-key)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from Services.admin_outreach import (
    service_outreach_candidates,
    service_outreach_draft,
    service_outreach_send,
    service_outreach_templates_get,
    service_outreach_templates_save,
)

router = APIRouter(prefix="/admin-outreach", tags=["admin-outreach"])


def _require_admin_api_key(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Admin API Key")


def _out(res: Dict[str, Any]) -> Dict[str, Any]:
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code")}
    return {"success": True, **{k: v for k, v in res.items() if k != "ok"}}


@router.get("/candidates")
def get_candidates(x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_outreach_candidates(ctx=service_ctx("admin_outreach.candidates")))


# statické cesty pred parametrickými
@router.get("/templates")
def get_templates(x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_outreach_templates_get(ctx=service_ctx("admin_outreach.templates_get")))


class TemplatesIn(BaseModel):
    templates: Dict[str, Dict[str, str]]

    model_config = ConfigDict(extra="forbid")


@router.put("/templates")
def put_templates(payload: TemplatesIn, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_outreach_templates_save(payload.templates, ctx=service_ctx("admin_outreach.templates_save")))


@router.get("/draft/{user_id}")
def get_draft(user_id: int, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_outreach_draft(user_id, ctx=service_ctx(f"admin_outreach.draft.{user_id}")))


class SendIn(BaseModel):
    subject: str = Field(..., max_length=300)
    body: str = Field(..., max_length=20000)
    force: bool = False

    model_config = ConfigDict(extra="forbid")


@router.post("/send/{user_id}")
def post_send(user_id: int, payload: SendIn, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    res = service_outreach_send(
        user_id,
        payload.subject,
        payload.body,
        force=payload.force,
        ctx=service_ctx(f"admin_outreach.send.{user_id}"),
    )
    return _out(res)
