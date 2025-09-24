# Services/bests.py
# Business/DB logika pre osobné rekordy (users_bests)

from datetime import datetime
from typing import List, Dict, Any
from Services.db import supabase, TABLE_USERS_BESTS
from Services.time import hhmmss_to_seconds, seconds_to_hhmmss
from fastapi import HTTPException

STD_DISTANCES = [400, 1000, 5000, 10000,20000, 21097, 30000, 42195, 50000]

def fetch_user_bests(user_id: int) -> List[Dict[str, Any]]:
    """Načítaj PB pre používateľa.
    Stĺpce v DB: distance_m, best_time_s, activity_id, achieved_at, updated_at, user_id[, user_uid]
    """
    try:
        res = (
            supabase.table(TABLE_USERS_BESTS)
            .select("distance_m,best_time_s,activity_id,achieved_at,updated_at")
            .eq("user_id", user_id)
            .order("distance_m", desc=False)
            .execute()
        )
        out: List[Dict[str, Any]] = []
        for r in (res.data or []):
            bt = r.get("best_time_s")
            out.append({
                "distance_m": r.get("distance_m"),
                "best_time_s": bt,
                "time_str": seconds_to_hhmmss(bt),  # pre FE pohodlnejšie
                "activity_id": r.get("activity_id"),
                "achieved_at": r.get("achieved_at"),
                "updated_at": r.get("updated_at"),
            })
        return out
    except Exception:
        return []

def upsert_user_best(user_id: int, payload: Dict) -> Dict:
    """
    Upsert jedného PB.
    Očakáva: { distance_m, time_sec | time_str, date?, activity_id?, achieved_at? }
    """
    distance_m = payload.get("distance_m")
    if distance_m is None:
        raise HTTPException(status_code=400, detail="Missing distance_m")
    try:
        distance_m = int(distance_m)
    except Exception:
        raise HTTPException(status_code=400, detail="distance_m must be a number")

    if distance_m not in STD_DISTANCES:
        raise HTTPException(status_code=400, detail="Unsupported distance")

    time_sec = payload.get("time_sec")
    if time_sec is None:
        time_sec = hhmmss_to_seconds(payload.get("time_str"))
    if not time_sec:
        raise HTTPException(status_code=400, detail="Missing/invalid time")

    rec = {
        "user_id": user_id,
        "distance_m": distance_m,
        "best_time_s": int(time_sec),
        "activity_id": payload.get("activity_id"),
        "achieved_at": payload.get("achieved_at"),
        "updated_at": datetime.utcnow().isoformat(),
    }

    supabase.table(TABLE_USERS_BESTS).upsert(rec, on_conflict="user_id,distance_m").execute()
    return rec