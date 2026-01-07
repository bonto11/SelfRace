from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from Services.users import require_jwt

from Services.time import hhmmss_to_seconds, seconds_to_hhmmss
from Routes_DB.user_bests import (
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
    sport: str = "run",
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Vysoko-úrovňový fetch:
      - zavolá DB vrstvu
      - dopočíta time_str z best_time_s
    """
    user_jwt = require_jwt(user_jwt)
    rows = db_fetch_user_bests(user_id, sport, user_jwt=user_jwt)
    for r in rows:
        best_time_s = r.get("best_time_s") or 0
        r["time_str"] = seconds_to_hhmmss(best_time_s)
    return rows


def service_upsert_user_best(
    user_id: int,
    payload: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validácia + normalizácia payloadu a následný UPSERT do DB.
    """
    user_jwt = require_jwt(user_jwt)

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

    saved = db_upsert_user_best(row, user_jwt=user_jwt)

    best_time_s = saved.get("best_time_s") or row["best_time_s"]
    saved["time_str"] = seconds_to_hhmmss(best_time_s)

    return saved


def service_delete_user_best(
    user_id: int,
    sport: str,
    distance_m: int,
    user_jwt: Optional[str] = None,
) -> int:
    """
    Tenšia obálka okolo DB delete – kvôli konzistencii service vrstvy.
    """
    user_jwt = require_jwt(user_jwt)
    return db_delete_user_best(user_id, sport, distance_m, user_jwt=user_jwt)


def service_build_bests_block_for_analysis(
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Minimalizované PB pre AI:
      { run: [...], ride: [...] } – zatiaľ len run.

    Režimy:
      - service=False: RLS (require_jwt + RLS klient).
      - service=True: service DB klient (user_jwt forward, bez require_jwt).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    out: Dict[str, List[Dict[str, Any]]] = {"run": [], "ride": []}

    # priamo DB vrstva, ale so service flagom
    run_rows = db_fetch_user_bests(
        user_id,
        "run",
        user_jwt=jwt,
        service=service,
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