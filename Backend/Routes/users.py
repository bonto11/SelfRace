from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request

from Services.users import service_resolve_user
from Schemas.users import ResolveIn
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/resolve")
async def resolve_user(
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