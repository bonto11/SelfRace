# Routes/admin_users.py
"""Admin zásahy do účtov (x-api-key) – okamžité zmazanie účtu, skúšobné maily podľa šablón."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from Services.admin_users import service_admin_force_delete_user, service_admin_test_email

router = APIRouter(prefix="/admin-users", tags=["admin-users"])


def _require_admin_api_key(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Admin API Key")


class ForceDeleteIn(BaseModel):
    # e-mail mazaného účtu – druhý krok potvrdenia
    confirm_email: str = Field(..., max_length=320)

    model_config = ConfigDict(extra="forbid")


class TestEmailIn(BaseModel):
    to: str = Field(..., max_length=320)
    template: str = Field(..., max_length=32)
    lang: Optional[str] = Field(default=None, max_length=5)
    name: Optional[str] = Field(default=None, max_length=120)

    model_config = ConfigDict(extra="forbid")


# statická cesta pred parametrickou
@router.post("/test-email")
def post_test_email(payload: TestEmailIn, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    res = service_admin_test_email(
        payload.to, payload.template, payload.lang, payload.name, ctx=service_ctx("admin_users.test_email")
    )
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code"), "detail": res.get("detail")}
    return {"success": True, "to": res.get("to"), "subject": res.get("subject")}


@router.post("/{user_id}/force-delete")
def post_force_delete(user_id: int, payload: ForceDeleteIn, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    res = service_admin_force_delete_user(
        user_id, payload.confirm_email, ctx=service_ctx(f"admin_users.force_delete.{user_id}")
    )
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code"), "detail": res.get("detail")}
    return {"success": True, **{k: v for k, v in res.items() if k != "ok"}}
