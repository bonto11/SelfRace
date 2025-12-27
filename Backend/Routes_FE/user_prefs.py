# Routes_FE/user_prefs.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException

from Services.user_prefs import (
    service_get_user_prefs_list,
    service_get_user_pref,
    service_save_user_pref,
    service_save_user_prefs_bulk,
    service_delete_user_pref,
)
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/prefs")
def get_user_prefs(
    user_id: int,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        prefs = service_get_user_prefs_list(user_id, user_jwt=user_jwt)
        return {"success": True, "prefs": prefs}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/prefs/{key}")
def get_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        val = service_get_user_pref(user_id, key, user_jwt=user_jwt)
        return {"success": True, "key": key, "value": val}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/prefs/{key}")
def put_user_pref(
    user_id: int,
    key: str,
    value: Any = Body(...),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        saved = service_save_user_pref(
            user_id,
            key,
            value,
            user_jwt=user_jwt,
        )
        return {"success": True, "saved": saved}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/prefs")
def put_user_prefs(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        n = service_save_user_prefs_bulk(
            user_id,
            payload or {},
            user_jwt=user_jwt,
        )
        return {"success": True, "count": n}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/prefs/{key}")
def del_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        n = service_delete_user_pref(
            user_id,
            key,
            user_jwt=user_jwt,
        )
        return {"success": True, "deleted": n}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))