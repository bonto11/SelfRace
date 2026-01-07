# Routes_FE/profile_static.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends

from Services.profile_static import (
    service_get_static_profile,
    service_upsert_static_profile,
)
from Schemas.profile_static import StaticPayload
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/profile", tags=["profile-static"])


@router.get("/static/{user_id}")
def get_static(
    user_id: int,
    user_uid: Optional[str] = Query(None),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    GET /profile/static/:user_id
    """
    try:
        row = service_get_static_profile(
            user_id=user_id,
            user_uid=user_uid,
            user_jwt=user_jwt,
        )
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/static/{user_id}")
def upsert_static(
    user_id: int,
    payload: StaticPayload,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    POST /profile/static/:user_id
    """
    try:
        row = service_upsert_static_profile(
            user_id=user_id,
            payload=payload,
            user_jwt=user_jwt,
        )
        return {"success": True, "data": row}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))