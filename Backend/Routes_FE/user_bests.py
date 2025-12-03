# Routes_FE/user_bests.py
from __future__ import annotations
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException

from Services.user_bests import (
    service_fetch_user_bests,
    service_upsert_user_best,
    service_delete_user_best,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/bests")
def get_bests(user_id: int, sport: str = "run"):
    try:
        bests = service_fetch_user_bests(user_id, sport)
        return {"success": True, "bests": bests}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/bests")
def put_best(user_id: int, payload: Dict[str, Any] = Body(...)):
    try:
        saved = service_upsert_user_best(user_id, payload)
        return {"success": True, "saved": saved}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/bests/{sport}/{distance_m}")
def del_best(user_id: int, sport: str, distance_m: int):
    try:
        deleted = service_delete_user_best(user_id, sport, int(distance_m))
        return {"success": True, "deleted": deleted}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))