# Routes/features.py
"""Prepínače nových funkcií – čítanie pre FE a správa v admin paneli (x-api-key)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import get_auth_ctx, require_user
from Modules.Supabase.ownership import caller_user_id
from Services.features import (
    service_features_admin_add_beta,
    service_features_admin_get,
    service_features_admin_remove_beta,
    service_features_admin_set_stage,
    service_user_features,
)

router = APIRouter(prefix="/features", tags=["features"])


def _require_admin_api_key(x_api_key: Optional[str]) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Admin API Key")


def _out(res: Dict[str, Any]) -> Dict[str, Any]:
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "features_failed"}
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}


@router.get("/me")
def get_my_features(req: Request) -> Dict[str, Any]:
    # PREČO user z JWT a nie z cesty: počas prezerania zverenca platia
    # funkcie trénera, nie zverenca.
    ctx = require_user(get_auth_ctx(req))
    uid = caller_user_id(ctx)
    return {"success": True, "data": {"user_id": uid, "features": service_user_features(uid)}}


class StageIn(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    stage: str = Field(..., min_length=1, max_length=16)

    model_config = ConfigDict(extra="forbid")


class BetaIn(BaseModel):
    user: str = Field(..., min_length=1, max_length=200)

    model_config = ConfigDict(extra="forbid")


@router.get("/admin")
def admin_get(x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_features_admin_get())


@router.put("/admin/stage")
def admin_set_stage(payload: StageIn, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_features_admin_set_stage(payload.key, payload.stage))


@router.post("/admin/beta")
def admin_add_beta(payload: BetaIn, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_features_admin_add_beta(payload.user))


@router.delete("/admin/beta/{user_id}")
def admin_remove_beta(user_id: int, x_api_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _require_admin_api_key(x_api_key)
    return _out(service_features_admin_remove_beta(user_id))
