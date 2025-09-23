# Routes/user_bests.py
from fastapi import APIRouter, Body, HTTPException
from datetime import datetime
from Services.db import supabase, TABLE_USERS_BESTS
from typing import Dict

router = APIRouter(prefix="/users", tags=["users"])

STD_DISTANCES = [400, 1000, 5000, 21097, 42195]

def _hhmmss_to_seconds(s: str | None) -> int | None:
    if not s: return None
    parts = [int(x) for x in s.split(":")]
    if len(parts)==3:
        h,m,sec = parts
    elif len(parts)==2:
        h,m,sec = 0, parts[0], parts[1]
    else:
        return None
    return h*3600 + m*60 + sec

@router.get("/{user_id}/bests")
def get_bests(user_id: int):
    from Routes.context import fetch_user_bests
    return {"success": True, "bests": fetch_user_bests(user_id)}

@router.put("/{user_id}/bests")
def upsert_best(user_id: int, payload: dict = Body(...)):
    try:
        distance_m = payload.get("distance_m")
        if distance_m is None:
            raise HTTPException(status_code=400, detail="Missing distance_m")
        distance_m = int(distance_m)
        if distance_m not in STD_DISTANCES:
            raise HTTPException(status_code=400, detail="Unsupported distance")

        time_sec = payload.get("time_sec")
        if time_sec is None:
            time_sec = _hhmmss_to_seconds(payload.get("time_str"))
        if not time_sec:
            raise HTTPException(status_code=400, detail="Missing/invalid time")

        rec = {
            "user_id": user_id,
            "distance_m": distance_m,
            "best_time_s": int(time_sec),
            "event_name": payload.get("event_name"),
            "achieved_at": payload.get("achieved_at"),
            "activity_id": payload.get("activity_id"),
            "updated_at": datetime.utcnow().isoformat(),
        }
        supabase.table(TABLE_USERS_BESTS).upsert(rec, on_conflict="user_id,distance_m").execute()
        return {"success": True}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))