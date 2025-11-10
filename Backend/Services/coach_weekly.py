# Services/coach_weekly.py
from __future__ import annotations
from typing import Any, Dict, List, Optional
from collections import defaultdict
from datetime import date
from Services.time import week_key, week_bounds, since_weeks_utc
from Services.analytics import compute_trimp, monotony_and_strain
from Services.Supabase.user_profile import fetch_user_sex, fetch_user_hr_max
from Services.Supabase.user_recovery import fetch_rhr_map_since, rhr_for_date
from Services.Supabase.activities_summary import fetch_summary_since

def _bucket_simple(s: str) -> str:
    s = (s or "").lower()
    if "run" in s: return "run"
    if "ride" in s or "bike" in s or "cycle" in s: return "ride"
    if "strength" in s or "weight" in s or "gym" in s: return "strength"
    return "other"

def build_weekly_context(user_id: int, weeks: int = 12) -> Dict[str, Any]:
    # profily na TRIMP
    sex: Optional[str] = fetch_user_sex(user_id)
    hr_max: Optional[float] = fetch_user_hr_max(user_id)

    since_iso = since_weeks_utc(weeks).isoformat()
    rhr_by_date = fetch_rhr_map_since(user_id, since_iso)
    rows = fetch_summary_since(user_id, since_iso)

    week_agg: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "trimp": 0.0, "trimp_run": 0.0, "trimp_ride": 0.0, "trimp_strength": 0.0, "trimp_other": 0.0,
        "time_min": 0.0, "time_run_min": 0.0, "time_ride_min": 0.0, "time_strength_min": 0.0, "time_other_min": 0.0,
        "km_total": 0.0, "km_run": 0.0, "km_ride": 0.0,
        "day_trimp": defaultdict(float), "day_time": defaultdict(float), "day_km": defaultdict(float),
        "examples": [],
    })

    for r in rows:
        d_str = (r.get("date") or "")[:10]
        if not d_str:
            continue
        try:
            d = date.fromisoformat(d_str)
        except Exception:
            continue

        wk = week_key(d)
        raw_type = (r.get("sport_type_ovrd") or r.get("sport_type_fe") or r.get("sport_type") or r.get("name") or "")
        bucket = _bucket_simple(raw_type)

        dist_km = float(r.get("distance_m") or 0.0) / 1000.0
        time_min = float(r.get("moving_time_s") or 0.0) / 60.0
        avg_hr = r.get("average_heartrate_bpm") or r.get("average_hr")
        rhr = rhr_for_date(rhr_by_date, d_str)

        tr = compute_trimp(avg_hr, time_min, hr_max, rhr, sex)

        wa = week_agg[wk]
        wa["trimp"] += tr
        wa["time_min"] += time_min
        wa["km_total"] += dist_km

        iso = d.isoformat()
        wa["day_trimp"][iso] += tr
        wa["day_time"][iso] += time_min
        wa["day_km"][iso] += dist_km

        if bucket == "run":
            wa["trimp_run"] += tr; wa["time_run_min"] += time_min; wa["km_run"] += dist_km
        elif bucket == "ride":
            wa["trimp_ride"] += tr; wa["time_ride_min"] += time_min; wa["km_ride"] += dist_km
        elif bucket == "strength":
            wa["trimp_strength"] += tr; wa["time_strength_min"] += time_min
        else:
            wa["trimp_other"] += tr; wa["time_other_min"] += time_min

        if len(wa["examples"]) < 6:
            wa["examples"].append({
                "date": d_str,
                "sport": r.get("sport_type"),
                "name": r.get("name"),
                "id": r.get("activity_id"),
            })

    out_weeks: List[Dict[str, Any]] = []
    for wk in sorted(week_agg.keys()):
        start, end = week_bounds(wk)
        wa = week_agg[wk]
        mono_km, strain_km = monotony_and_strain(wa["day_km"], start, wa["km_total"])
        mono_tm, strain_tm = monotony_and_strain(wa["day_time"], start, wa["time_min"])
        mono_tr, strain_tr = monotony_and_strain(wa["day_trimp"], start, wa["trimp"])
        out_weeks.append({
            "week": wk,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "km_total": wa["km_total"], "km_run": wa["km_run"], "km_ride": wa["km_ride"],
            "time_min": wa["time_min"], "time_run_min": wa["time_run_min"], "time_ride_min": wa["time_ride_min"],
            "time_strength_min": wa["time_strength_min"], "time_other_min": wa["time_other_min"],
            "trimp": wa["trimp"], "trimp_run": wa["trimp_run"], "trimp_ride": wa["trimp_ride"], "trimp_strength": wa["trimp_strength"], "trimp_other": wa["trimp_other"],
            "monotony": {"km": mono_km, "time": mono_tm, "trimp": mono_tr},
            "strain": {"km": strain_km, "time": strain_tm, "trimp": strain_tr},
            "examples": wa["examples"],
        })

    return {"weeks": out_weeks, "hr_used": {"sex": sex, "hr_max": hr_max}}