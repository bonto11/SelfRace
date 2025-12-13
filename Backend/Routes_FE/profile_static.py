# Routes_FE/profile_static.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from Services.profile_static import (
    service_get_static_profile,
    service_upsert_static_profile,
    StaticPayload,
)

router = APIRouter(prefix="/profile", tags=["profile-static"])


@router.get("/static/{user_id}")
def get_static(user_id: int, user_uid: Optional[str] = Query(None)):
    """
    GET /profile/static/:user_id
    """
    row = service_get_static_profile(user_id=user_id, user_uid=user_uid)
    return {"success": True, "data": row}


@router.post("/static/{user_id}")
def upsert_static(user_id: int, payload: StaticPayload):
    """
    POST /profile/static/:user_id
    """
    row = service_upsert_static_profile(user_id=user_id, payload=payload)
    return {"success": True, "data": row}
