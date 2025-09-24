# backend/Routes/user_bests.py
# REST pre osobné rekordy (users/{id}/bests)
# - Tenká endpoint vrstva: validácia vstupu + volanie Services vrstvy.
# - Stĺpce v DB: distance_m, best_time_s, activity_id, achieved_at, updated_at, user_id

from fastapi import APIRouter, Body, HTTPException
from datetime import datetime
from typing import Any, Dict, Optional

from Services.db import supabase, TABLE_USERS_BESTS
from Services.time import hhmmss_to_seconds
from Services.bests import fetch_user_bests, STD_DISTANCES

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}/bests")
def get_bests(user_id: int):
    return {"success": True, "bests": fetch_user_bests(user_id)}

@router.put("/{user_id}/bests")
def upsert_best(user_id: int, payload: Dict[str, Any] = Body(...)):
    """
    Upsert jedného PR: { distance_m, time_sec|time_str, activity_id?, achieved_at? }
    - distance_m musí byť v STD_DISTANCES
    - čas môže prísť ako time_sec (int) alebo time_str ("hh:mm:ss")
    - activity_id a achieved_at sú voliteľné
    """

    # -------- distance_m (type-narrowing pre Pylance)
    raw_dist: Any = payload.get("distance_m")
    if raw_dist is None:
        raise HTTPException(status_code=400, detail="Missing distance_m")

    distance_m: int
    if isinstance(raw_dist, bool):
        raise HTTPException(status_code=400, detail="distance_m must be an integer")
    elif isinstance(raw_dist, (int, float)):
        distance_m = int(raw_dist)
    elif isinstance(raw_dist, str):
        s = raw_dist.strip()
        if not s:
            raise HTTPException(status_code=400, detail="distance_m must be an integer")
        try:
            distance_m = int(s)
        except Exception:
            raise HTTPException(status_code=400, detail="distance_m must be an integer")
    else:
        raise HTTPException(status_code=400, detail="distance_m must be an integer")

    if distance_m not in STD_DISTANCES:
        raise HTTPException(status_code=400, detail="Unsupported distance")

    # -------- time_sec / time_str (tiež bezpečne)
    time_sec_val: Any = payload.get("time_sec")
    time_sec: Optional[int] = None

    if time_sec_val is not None:
        if isinstance(time_sec_val, bool):
            raise HTTPException(status_code=400, detail="time_sec must be an integer")
        try:
            # ak by prišlo ako "3600" alebo 3600.0
            time_sec = int(str(time_sec_val).strip())
        except Exception:
            raise HTTPException(status_code=400, detail="time_sec must be an integer")
    else:
        time_str_val: Any = payload.get("time_str")
        time_sec = hhmmss_to_seconds(time_str_val if isinstance(time_str_val, str) else None)

    if not time_sec:
        raise HTTPException(status_code=400, detail="Missing/invalid time (time_sec/time_str)")

    # -------- activity_id (voliteľné; prázdne/nečíselné -> None)
    activity_id: Optional[int] = None
    act_raw: Any = payload.get("activity_id")
    if act_raw not in (None, "", "null"):
        try:
            activity_id = int(str(act_raw).strip())
        except Exception:
            activity_id = None

    # -------- achieved_at (voliteľné; prázdne -> None; DB má timestamptz = "YYYY-MM-DD" tiež prehltne)
    achieved_at_raw: Any = payload.get("achieved_at")
    achieved_at: Optional[str] = None
    if isinstance(achieved_at_raw, str) and achieved_at_raw.strip():
        achieved_at = achieved_at_raw.strip()

    rec = {
        "user_id": user_id,
        "distance_m": distance_m,
        "best_time_s": int(time_sec),
        "activity_id": activity_id,
        "achieved_at": achieved_at,
        "updated_at": datetime.utcnow().isoformat(),
    }

    (
        supabase.table(TABLE_USERS_BESTS)
        # POZOR: v DB musí byť UNIQUE(user_id, distance_m)
        .upsert(rec, on_conflict="user_id,distance_m")
        .execute()
    )

    return {"success": True, "saved": rec}