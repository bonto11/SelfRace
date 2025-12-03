# Routes_FE/users.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException

from Services.users import service_resolve_user
from Schemas.users import ResolveIn

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/resolve")
async def resolve_user(payload: ResolveIn):
    """
    POST /users/resolve
    Body: { "auth_uid": "..."} alebo { "supabase_uid": "..." }

    Response (rovnaké ako doteraz):
      - { "success": false, "error": "User not found in DB" }
      - { "success": true, "user_id": <int> }
    """
    uid = payload.auth_uid or payload.supabase_uid
    if not uid:
        raise HTTPException(status_code=400, detail="Missing auth_uid")

    user_id = service_resolve_user(uid)
    if user_id is None:
        return {"success": False, "error": "User not found in DB"}

    return {"success": True, "user_id": user_id}
