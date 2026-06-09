# Services/monthly_summary.py — s debugom
from __future__ import annotations

import math
from calendar import monthrange
from collections import defaultdict
from typing import Any, Dict, List, Optional
from DB.activities_summary import db_get_activities_for_month
from DB.activities_enrichment import db_get_zone_minutes_for_ids
from DB.user_recovery import db_get_recovery_for_month
from Modules.Supabase.auth import AuthCtx

_DIST_SPORTS = {
    "run",
    "running",
    "ride",
    "bike",
    "cycling",
    "swim",
    "swimming",
    "mixed",
}


def _norm_sport(s: Optional[str]) -> str:
    s = (s or "other").lower().strip()
    if s in ("run", "running"):
        return "run"
    if s in ("ride", "bike", "cycling"):
        return "ride"
    if s in ("swim", "swimming"):
        return "swim"
    if s in ("strength",):
        return "strength"
    if s in ("mixed",):
        return "mixed"
    if s in ("walk",):
        return "walk"
    return "other"


def _to_f(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except Exception:
        return 0.0


def _avg_sleep_start(starts: List[str]) -> Optional[str]:
    angles = []
    for s in starts:
        if not s:
            continue
        try:
            parts = str(s).split(":")
            h, m = int(parts[0]), int(parts[1])
            total_min = h * 60 + m
            if total_min < 360:
                total_min += 1440
            angles.append(2 * math.pi * total_min / 1440)
        except Exception:
            continue
    if not angles:
        return None
    sin_avg = sum(math.sin(a) for a in angles) / len(angles)
    cos_avg = sum(math.cos(a) for a in angles) / len(angles)
    avg_angle = math.atan2(sin_avg, cos_avg)
    if avg_angle < 0:
        avg_angle += 2 * math.pi
    avg_min = round((avg_angle / (2 * math.pi)) * 1440) % 1440
    return f"{avg_min // 60:02d}:{avg_min % 60:02d}"


def service_get_monthly_summary(
    user_id: int,
    year: int,
    month: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    _, last_day = monthrange(year, month)

    # ── 1. Aktivity ──────────────────────────────────────────────────────────
    activities = db_get_activities_for_month(user_id, year, month, ctx=ctx)

    sport_time: Dict[str, float] = defaultdict(float)
    sport_dist: Dict[str, float] = defaultdict(float)
    sport_count: Dict[str, int] = defaultdict(int)
    sport_longest: Dict[str, float] = defaultdict(float)
    activity_ids: List[int] = []

    for act in activities:
        aid = act.get("activity_id")
        if aid:
            activity_ids.append(int(aid))
        sport = _norm_sport(act.get("sport_type_fe"))
        time_s = _to_f(act.get("moving_time_s") or act.get("elapsed_time_s"))
        dist_m = _to_f(act.get("distance_m"))
        sport_time[sport] += time_s
        sport_dist[sport] += dist_m
        sport_count[sport] += 1
        if time_s > sport_longest.get(sport, 0):
            sport_longest[sport] = time_s

    sport_stats: Dict[str, Any] = {}
    for sport in sport_time:
        t = sport_time[sport]
        d = sport_dist[sport]
        cnt = sport_count[sport]
        avg_speed_mps = (d / t) if t > 0 and sport in _DIST_SPORTS and d > 0 else None
        sport_stats[sport] = {
            "count": cnt,
            "total_time_s": round(t),
            "avg_time_s": round(t / cnt) if cnt else 0,
            "longest_s": round(sport_longest.get(sport, 0)),
            "total_dist_m": round(d) if sport in _DIST_SPORTS else None,
            "avg_speed_mps": round(avg_speed_mps, 3) if avg_speed_mps else None,
        }

    # ── 2. Zóny ──────────────────────────────────────────────────────────────
    zone_rows = db_get_zone_minutes_for_ids(user_id, activity_ids, ctx=ctx)

    zones: Dict[str, float] = {"z1": 0.0, "z2": 0.0, "z3": 0.0, "z4": 0.0, "z5": 0.0}
    for row in zone_rows:
        for z in ("z1", "z2", "z3", "z4", "z5"):
            zones[z] += _to_f(row.get(f"{z}_min"))
    zones_rounded = {k: round(v, 1) for k, v in zones.items() if v > 0}


    # ── 3. Recovery ───────────────────────────────────────────────────────────
    rec_rows = db_get_recovery_for_month(user_id, year, month, ctx=ctx)

    hrv_vals, rhr_vals, sleep_vals, start_vals = [], [], [], []
    for r in rec_rows:
        if r.get("HRV_avg_ms") is not None:
            hrv_vals.append(_to_f(r["HRV_avg_ms"]))
        if r.get("RHR_bpm") is not None:
            rhr_vals.append(_to_f(r["RHR_bpm"]))
        if r.get("sleep_duration_min") is not None:
            sleep_vals.append(_to_f(r["sleep_duration_min"]))
        if r.get("sleep_start_time"):
            start_vals.append(str(r["sleep_start_time"]))

    def _avg(lst: List[float]) -> Optional[float]:
        return round(sum(lst) / len(lst), 1) if lst else None

    recovery_stats: Dict[str, Any] = {
        "days_recorded": len(rec_rows),
        "avg_hrv_ms": _avg(hrv_vals),
        "avg_rhr_bpm": _avg(rhr_vals),
        "avg_sleep_duration_min": _avg(sleep_vals),
        "avg_sleep_start": _avg_sleep_start(start_vals),
    }
    recovery_stats = {
        k: v for k, v in recovery_stats.items() if v is not None or k == "days_recorded"
    }

    # ── 4. Výsledok ───────────────────────────────────────────────────────────
    total_time_s = sum(sport_time.values())
    total_dist_m = sum(v for k, v in sport_dist.items() if k in _DIST_SPORTS)
    total_sessions = sum(sport_count.values())

    result = {
        "period": {
            "year": year,
            "month": month,
            "from": f"{year}-{month:02d}-01",
            "to": f"{year}-{month:02d}-{last_day:02d}",
        },
        "summary": {
            "total_sessions": total_sessions,
            "total_time_s": round(total_time_s),
            "total_dist_m": round(total_dist_m),
        },
        "sport_stats": sport_stats,
        "zones_min": zones_rounded,
        "recovery": recovery_stats,
    }
  
    return result
