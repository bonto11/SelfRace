from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, HTTPException
from Routes_DB.user_prefs import (
    fetch_all_prefs, fetch_pref, upsert_pref, upsert_many, delete_pref
)

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}/prefs")
def get_user_prefs(user_id: int):
    try:
        return {"success": True, "prefs": fetch_all_prefs(user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/prefs/{key}")
def get_user_pref(user_id: int, key: str):
    try:
        row = fetch_pref(user_id, key)
        return {"success": True, "pref": row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/prefs/{key}")
def put_user_pref(user_id: int, key: str, value: Any = Body(...)):
    try:
        saved = upsert_pref(user_id, key, value)
        return {"success": True, "saved": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/prefs")
def put_user_prefs(user_id: int, payload: Dict[str, Any] = Body(...)):
    try:
        n = upsert_many(user_id, payload or {})
        return {"success": True, "count": n}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}/prefs/{key}")
def del_user_pref(user_id: int, key: str):
    try:
        n = delete_pref(user_id, key)
        return {"success": True, "deleted": n}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))