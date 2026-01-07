# Routes_FE/user_bests.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException

from Services.user_bests import (
    service_fetch_user_bests,
    service_upsert_user_best,
    service_delete_user_best,
)
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/bests")
def get_bests(
    user_id: int,
    sport: str = "run",
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        bests = service_fetch_user_bests(
            user_id,
            sport,
            user_jwt=user_jwt,
        )
        return {"success": True, "bests": bests}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/bests")
def put_best(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        saved = service_upsert_user_best(
            user_id,
            payload,
            user_jwt=user_jwt,
        )
        return {"success": True, "saved": saved}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/bests/{sport}/{distance_m}")
def del_best(
    user_id: int,
    sport: str,
    distance_m: int,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        deleted = service_delete_user_best(
            user_id,
            sport,
            int(distance_m),
            user_jwt=user_jwt,
        )
        return {"success": True, "deleted": deleted}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))