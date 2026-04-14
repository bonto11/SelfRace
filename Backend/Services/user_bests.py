from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from Modules.Supabase.auth import AuthCtx
from DB.activities_summary import db_get_activity_summary_one
from Services.time import hhmmss_to_seconds, seconds_to_hhmmss
from DB.user_bests import (
    db_fetch_user_bests,
    db_upsert_user_best,
    db_delete_user_best,
)

# povolené vzdialenosti podľa športu
STD_DISTANCES_BY_SPORT: dict[str, list[int]] = {
    "run": [400, 1000, 5000, 10000, 20000, 21097, 30000, 42195, 50000],
    # "bike": [...],
    # "skate": [...],
}


def allowed_distances(sport: str) -> List[int]:
    return STD_DISTANCES_BY_SPORT.get(sport, [])


def service_fetch_user_bests(
    user_id: int,
    ctx: AuthCtx,
    sport: str = "run",
) -> List[Dict[str, Any]]:
    """
    Vysoko-úrovňový fetch:
      - zavolá DB vrstvu
      - dopočíta time_str z best_time_s
    """
    
    rows = db_fetch_user_bests(user_id, sport, ctx=ctx)
    for r in rows:
        best_time_s = r.get("best_time_s") or 0
        r["time_str"] = seconds_to_hhmmss(best_time_s)
    return rows


def service_upsert_user_best(
    user_id: int,
    payload: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Validácia + normalizácia payloadu a následný UPSERT do DB.
    """
    sport = str(payload.get("sport") or "run").lower()

    # --- distance ---
    raw_dist = payload.get("distance_m")
    if raw_dist is None or (isinstance(raw_dist, str) and not raw_dist.strip()):
        raise ValueError("Missing distance_m")
    try:
        distance_m = int(str(raw_dist))
    except Exception:
        raise ValueError("distance_m must be an integer")

    if allowed_distances(sport) and distance_m not in allowed_distances(sport):
        raise ValueError("Unsupported distance for sport")

    # --- time ---
    if payload.get("time_sec") is not None:
        try:
            time_sec = int(str(payload["time_sec"]))
        except Exception:
            raise ValueError("time_sec must be an integer")
    else:
        time_sec = hhmmss_to_seconds(
            payload.get("time_str")
            if isinstance(payload.get("time_str"), str)
            else None
        )

    if not time_sec:
        raise ValueError("Missing/invalid time (time_sec/time_str)")

    # --- základ, ktoré vždy posielame ---
    row: Dict[str, Any] = {
        "user_id": user_id,
        "sport": sport,
        "distance_m": distance_m,
        "best_time_s": int(time_sec),
        "updated_at": datetime.utcnow().isoformat(),
    }

    # --- voliteľné polia: pridaj IBA ak prišli (neprepisuj na NULL) ---
    act = payload.get("activity_id", "__MISSING__")
    if act != "__MISSING__":
        try:
            row["activity_id"] = int(str(act)) if str(act).strip() else None
        except Exception:
            row["activity_id"] = None

    act_name = payload.get("activity_name", "__MISSING__")
    if act_name != "__MISSING__":
        v = (act_name or "").strip()
        row["activity_name"] = v if v else None

    ach = payload.get("achieved_at", "__MISSING__")
    if ach != "__MISSING__":
        row["achieved_at"] = ach if (isinstance(ach, str) and ach.strip()) else None

    # ✅ PRIDANÉ PRE WIDGET (Toto už máš)
    tot_dist = payload.get("total_distance_m", "__MISSING__")
    if tot_dist != "__MISSING__":
        try:
            row["total_distance_m"] = int(str(tot_dist)) if str(tot_dist).strip() else None
        except Exception:
            row["total_distance_m"] = None

    tot_time = payload.get("total_time_s", "__MISSING__")
    if tot_time != "__MISSING__":
        try:
            row["total_time_s"] = int(str(tot_time)) if str(tot_time).strip() else None
        except Exception:
            row["total_time_s"] = None

    # Ak máme activity_id, ale frontend nám neposlal total_distance_m alebo total_time_s
    act_id = row.get("activity_id")
    if act_id and (row.get("total_distance_m") is None or row.get("total_time_s") is None):
        # Pylance potrebuje istotu, že act_id je int
        summary = db_get_activity_summary_one(ctx, int(act_id))
        if summary:
            if row.get("total_distance_m") is None:
                row["total_distance_m"] = int(summary.get("distance_m") or 0) or None
            
            if row.get("total_time_s") is None:
                # Uprednostníme moving_time, ak nie je, vezmeme elapsed
                row["total_time_s"] = int(summary.get("moving_time_s") or summary.get("elapsed_time_s") or 0) or None
    # Uloženie do DB
    saved = db_upsert_user_best(row, ctx=ctx)

    best_time_s = saved.get("best_time_s") or row["best_time_s"]
    saved["time_str"] = seconds_to_hhmmss(best_time_s)

    return saved


def service_delete_user_best(
    user_id: int,
    sport: str,
    distance_m: int,
    ctx: AuthCtx,
) -> int:
    """
    Tenšia obálka okolo DB delete – kvôli konzistencii service vrstvy.
    """

    return db_delete_user_best(user_id, sport, distance_m, ctx=ctx)


def service_build_bests_block_for_analysis(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Minimalizované PB pre AI:
      { run: [...], ride: [...] } – zatiaľ len run.

    Režimy:
      - service=False: RLS (require_jwt + RLS klient).
      - service=True: service DB klient (user_jwt forward, bez require_jwt).
    """

    out: Dict[str, List[Dict[str, Any]]] = {"run": [], "ride": []}

    # priamo DB vrstva, ale so service flagom
    run_rows = db_fetch_user_bests(
        user_id,
        "run",
        ctx=ctx,
    )
    for r in run_rows:
        best_time_s = r.get("best_time_s") or 0
        time_str = seconds_to_hhmmss(best_time_s)

        out["run"].append(
            {
                "distance_m": r.get("distance_m"),
                "best_time_s": best_time_s,
                "time_str": time_str,
                "date": r.get("achieved_at") or r.get("updated_at"),
            }
        )

    # ak neskôr pridáš bike, doplníš aj "ride"

    return out