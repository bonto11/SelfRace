# backend/Services/bests.py
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime

from Services.db import supabase, TABLE_USERS_BESTS
from Services.time import hhmmss_to_seconds, seconds_to_hhmmss

# Povolené vzdialenosti pre jednotlivé športy (aktuálne RUN)
STD_DISTANCES_BY_SPORT: dict[str, list[int]] = {
    "run": [400, 1000, 5000, 10000, 20000, 21097, 30000, 42195, 50000],
    # "bike": [5000, 10000, 20000, 40000],  # príklady na neskôr
    # "skate": [],
    # "strength": [],                       # bude iná schéma (nie distance/time)
}

def allowed_distances(sport: str) -> List[int]:
    return STD_DISTANCES_BY_SPORT.get(sport, [])

def fetch_user_bests(user_id: int, sport: str = "run") -> List[Dict[str, Any]]:
    """Načíta bests pre daný šport; doplní aj time_str pre pohodlné zobrazenie."""
    try:
        res = (
            supabase.table(TABLE_USERS_BESTS)
            .select("sport,distance_m,best_time_s,activity_id,achieved_at,updated_at")
            .eq("user_id", user_id)
            .eq("sport", sport)
            .order("distance_m", desc=False)
            .execute()
        )
        rows = list(res.data or [])
        for r in rows:
            r["time_str"] = seconds_to_hhmmss(r.get("best_time_s"))
        return rows
    except Exception:
        return []

def upsert_user_best(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upsert jedného PR z FE. Očakáva:
      { sport?, distance_m, time_sec | time_str, activity_id?, achieved_at? }
    - sport default 'run'
    - kontrola distance_m podľa športu
    - time_sec uprednostnený, inak time_str ("hh:mm:ss")
    """
    # --- sport
    sport = str(payload.get("sport") or "run").lower()

    # --- distance_m
    raw_dist = payload.get("distance_m")
    if raw_dist is None or (isinstance(raw_dist, str) and not raw_dist.strip()):
        raise ValueError("Missing distance_m")
    try:
        distance_m = int(str(raw_dist))
    except Exception:
        raise ValueError("distance_m must be an integer")

    allowed = allowed_distances(sport)
    if allowed and distance_m not in allowed:
        raise ValueError("Unsupported distance for sport")

    # --- time (sec alebo hh:mm:ss)
    time_sec: Optional[int] = None
    if payload.get("time_sec") is not None:
        try:
            time_sec = int(str(payload.get("time_sec")))
        except Exception:
            raise ValueError("time_sec must be an integer")
    else:
        raw_ts = payload.get("time_str")
        time_sec = hhmmss_to_seconds(raw_ts if isinstance(raw_ts, str) and raw_ts.strip() else None)

    if not time_sec:
        raise ValueError("Missing/invalid time (time_sec/time_str)")

    # --- activity_id (voliteľné)
    activity_id: Optional[int] = None
    act = payload.get("activity_id")
    if act not in (None, "", "null"):
        try:
            activity_id = int(str(act))
        except Exception:
            activity_id = None  # nerozbíjaj uloženie, ak nevieme previesť

    # --- achieved_at (voliteľné; ukladáme ako string čo príde)
    achieved_at = payload.get("achieved_at")
    if not (isinstance(achieved_at, str) and achieved_at.strip()):
        achieved_at = None

    rec = {
        "user_id": user_id,
        "sport": sport,
        "distance_m": distance_m,
        "best_time_s": int(time_sec),
        "activity_id": activity_id,
        "achieved_at": achieved_at,
        "updated_at": datetime.utcnow().isoformat(),
    }

    # POZOR: v DB musí existovať PRIMARY KEY (user_id, sport, distance_m)
    (
        supabase.table(TABLE_USERS_BESTS)
        .upsert(rec, on_conflict="user_id,sport,distance_m")
        .execute()
    )

    # späť pošleme aj time_str pre FE
    return {**rec, "time_str": seconds_to_hhmmss(rec["best_time_s"]) }