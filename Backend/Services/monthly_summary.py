# Services/monthly_summary.py — s debugom
from __future__ import annotations

import math
from calendar import monthrange
from collections import defaultdict
from typing import Any, Dict, List, Optional
from Configs.strength_catalog import CATALOG_BY_ID
from Configs.strength_muscles import get_muscles
from DB.activities_summary import db_get_activities_for_month
from DB.activities_enrichment import db_get_zone_minutes_for_ids
from DB.strength_sessions import db_list_strength_sessions_between
from DB.user_recovery import db_get_recovery_for_month
from Modules.Supabase.auth import AuthCtx
from Services.strength_sessions import _is_done_set

# koľko cvikov ide do zhrnutia (najčastejšie) – celý denník by bol šum
STRENGTH_TOP_EXERCISES = 8

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


def _build_strength_month(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Silové zápisy za mesiac: tréningy, série, opakovania, objem, partie a
    najlepšie výkony v cvikoch.

    PREČO: zhrnutie stálo len na Strave – kto si silu len zapisuje, mal
    „žiadne dáta“, a bežec s posilňovňou videl len čas silových aktivít bez
    toho, čo v nich odcvičil. Odcvičená séria = má opakovania (_is_done_set).
    Objem a opakovania len pri cvikoch na opakovania (pri planku sú to sekundy).
    """
    sessions = 0
    logged_only = 0
    work_sets = 0
    total_reps = 0
    volume = 0.0
    muscles: Dict[str, float] = defaultdict(float)
    per_ex: Dict[str, Dict[str, Any]] = {}

    for row in rows or []:
        log = row.get("log")
        if not isinstance(log, dict):
            continue
        had_sets = False
        for ex in log.get("exercises") or []:
            if not isinstance(ex, dict):
                continue
            ex_id = str(ex.get("exercise_id") or "")
            done = [st for st in (ex.get("sets") or []) if _is_done_set(st)]
            if not ex_id or not done:
                continue
            had_sets = True
            meta = CATALOG_BY_ID.get(ex_id) or {}
            measure = meta.get("measure") or "reps"
            work_sets += len(done)
            for m, w in get_muscles(ex_id).items():
                muscles[m] += len(done) * float(w)

            item = per_ex.setdefault(
                ex_id,
                {
                    "exercise_id": ex_id,
                    "name": meta.get("name_en") or ex_id,
                    "measure": measure,
                    "sessions": 0,
                    "sets": 0,
                    "best_weight_kg": None,
                    "reps_at_best": None,
                    "max_reps": None,
                },
            )
            item["sessions"] += 1
            item["sets"] += len(done)
            for st in done:
                reps = int(_to_f(st.get("reps")))
                w = _to_f(st.get("weight_kg"))
                if measure == "reps":
                    total_reps += reps
                    if w > 0:
                        volume += w * reps
                best = item["best_weight_kg"]
                if w > 0 and (best is None or w > best or (w == best and reps > (item["reps_at_best"] or 0))):
                    item["best_weight_kg"] = round(w, 1)
                    item["reps_at_best"] = reps
                if item["max_reps"] is None or reps > item["max_reps"]:
                    item["max_reps"] = reps
        if had_sets:
            sessions += 1
            # so Strava aktivitou je tréning už v sport_stats – nerátať dvakrát
            if not row.get("activity_id"):
                logged_only += 1

    if not sessions:
        return None

    top = sorted(per_ex.values(), key=lambda e: (e["sessions"], e["sets"]), reverse=True)
    return {
        "sessions": sessions,
        "logged_only": logged_only,
        "work_sets": work_sets,
        "total_reps": total_reps,
        "volume_kg": round(volume),
        "muscle_sets": {
            m: round(v) for m, v in sorted(muscles.items(), key=lambda kv: -kv[1]) if round(v) > 0
        },
        "exercises": top[:STRENGTH_TOP_EXERCISES],
    }


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

    # ── 4. Silové zápisy ──────────────────────────────────────────────────────
    strength: Optional[Dict[str, Any]] = None
    try:
        strength = _build_strength_month(
            db_list_strength_sessions_between(
                user_id, f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last_day:02d}", ctx=ctx
            )
        )
    except Exception as e:  # noqa: BLE001
        # zhrnutie Stravy musí prejsť aj bez silového bloku
        print(f"[MONTHLY-SUMMARY] strength user={user_id} failed: {repr(e)}")

    # ── 5. Výsledok ───────────────────────────────────────────────────────────
    total_time_s = sum(sport_time.values())
    total_dist_m = sum(v for k, v in sport_dist.items() if k in _DIST_SPORTS)
    # ručné zápisy bez Stravy sú tiež tréningy (inak by user len so silou
    # mal "žiadne dáta" a mesačné hodnotenie by sa mu nevygenerovalo)
    total_sessions = sum(sport_count.values()) + (strength or {}).get("logged_only", 0)

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
        "strength": strength,
    }
  
    return result
