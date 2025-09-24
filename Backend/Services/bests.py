# Services/bests.py
from datetime import datetime
from typing import List, Dict
from Services.db import supabase, TABLE_USERS_BESTS
from Services.time import hhmmss_to_seconds, seconds_to_hhmmss
from fastapi import HTTPException

STD_DISTANCES = [400, 1000, 5000, 21097, 42195]

def fetch_user_bests(user_id: int) -> List[Dict]:
    """Vráti zoznam PB zoradený podľa distance_m, doplní time_str z best_time_s."""
    try:
        res = (
            supabase.table(TABLE_USERS_BESTS)
            .select("distance_m,best_time_s,event_name,date,activity_id,achieved_at,updated_at")
            .eq("user_id", user_id)
            .order("distance_m", desc=False)
            .execute()
        )
        out: List[Dict] = []
        for r in (res.data or []):
            bt = r.get("best_time_s")
            out.append({
                "distance_m": r.get("distance_m"),
                "best_time_s": bt,
                "time_str": seconds_to_hhmmss(bt),
                "event_name": r.get("event_name"),
                "date": r.get("date"),
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
    Očakáva: { distance_m, time_sec | time_str, event_name?, date?, activity_id?, achieved_at? }
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
        "event_name": payload.get("event_name"),
        "date": payload.get("date"),
        "activity_id": payload.get("activity_id"),
        "achieved_at": payload.get("achieved_at"),
        "updated_at": datetime.utcnow().isoformat(),
    }

    supabase.table(TABLE_USERS_BESTS).upsert(rec, on_conflict="user_id,distance_m").execute()
    return rec