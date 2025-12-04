# Routes_FE/user_prefs.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException

from Services.user_prefs import (
    service_get_user_prefs_list,
    service_get_user_pref,
    service_save_user_pref,
    service_save_user_prefs_bulk,
    service_delete_user_pref,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/prefs")
def get_user_prefs(user_id: int):
    try:
        return {"success": True, "prefs": service_get_user_prefs_list(user_id)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/prefs/{key}")
def get_user_pref(user_id: int, key: str):
    try:
        val = service_get_user_pref(user_id, key)
        print("val",val)
        return {"success": True, "key": key, "value": val}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/prefs/{key}")
def put_user_pref(user_id: int, key: str, value: Any = Body(...)):
    try:
        saved = service_save_user_pref(user_id, key, value)
        return {"success": True, "saved": saved}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/prefs")
def put_user_prefs(user_id: int, payload: Dict[str, Any] = Body(...)):
    try:
        n = service_save_user_prefs_bulk(user_id, payload or {})
        return {"success": True, "count": n}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/prefs/{key}")
def del_user_pref(user_id: int, key: str):
    try:
        n = service_delete_user_pref(user_id, key)
        return {"success": True, "deleted": n}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))