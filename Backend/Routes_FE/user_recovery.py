# Routes_FE/user_recovery.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from Services.user_recovery import (
    service_insert_or_update_recovery,
    service_get_recovery,
)
from Schemas.user_recovery import RecoveryIn
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/recovery", tags=["recovery"])


@router.post("")
def post_recovery(
    payload: RecoveryIn,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    print("[post_recovery] jwt_present =", bool(user_jwt))

    try:
        res = service_insert_or_update_recovery(
            payload.model_dump(),
            user_jwt=user_jwt,
        )
        return {"success": True, "data": res}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
def get_recovery(
    user_id: int,
    days: int = 14,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    print("[get_recovery] jwt_present =", bool(user_jwt))

    try:
        data = service_get_recovery(
            user_id,
            days,
            user_jwt=user_jwt,
        )
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))