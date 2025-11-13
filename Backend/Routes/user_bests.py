# backend/Routes/user_bests.py
# REST pre osobné rekordy (users/{id}/bests)
# - Tenká endpoint vrstva: validácia vstupu + volanie Services vrstvy.

from typing import Any, Dict
from fastapi import APIRouter, Body, HTTPException
from Services.Supabase.user_bests import fetch_user_bests, upsert_user_best, delete_user_best

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}/bests")
def get_bests(user_id: int, sport: str = "run"):
    try:
        return {"success": True, "bests": fetch_user_bests(user_id, sport)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/bests")
def put_best(user_id: int, payload: Dict[str, Any] = Body(...)):
    try:
        saved = upsert_user_best(user_id, payload)
        return {"success": True, "saved": saved}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}/bests/{sport}/{distance_m}")
def del_best(user_id: int, sport: str, distance_m: int):
    try:
        deleted = delete_user_best(user_id, sport, int(distance_m))
        return {"success": True, "deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))