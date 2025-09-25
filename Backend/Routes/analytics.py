# backend/Routes/analytics.py
# Weekly agregácie – používa sport_type_fe, koše: run, ride, strength, skate, mixed, other

from fastapi import APIRouter, HTTPException
from datetime import date, datetime, timedelta
from collections import defaultdict
from Services.time import week_key, week_bounds
from Services.analytics import sport_bucket, compute_trimp, monotony_and_strain
from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_USERS_STATIC,
    TABLE_USERS_METRICS,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])
supabase = get_client()

@router.get("/weekly/{user_id}")
def weekly(user_id: int, weeks: int = 12):
    """
    Týždenná agregácia za posledných N týždňov.
    - km/time/TRIMP rozdelené podľa: run, ride, strength, skate, mixed, other
    - Monotony/Strain k rovnakej metrike
    """
    try:
        # HR parametre
        sex = None; hr_max = None; rhr = None
        st = supabase.table(TABLE_USERS_STATIC).select("sex").eq("user_id", user_id).limit(1).execute()
        if st.data: sex = st.data[0].get("sex")
        mt = (supabase.table(TABLE_USERS_METRICS)
              .select("HR_max,RHR,updated_at").eq("user_id", user_id)
              .order("updated_at", desc=True).limit(1).execute())
        if mt.data:
            hr_max = mt.data[0].get("HR_max"); rhr = mt.data[0].get("RHR")

        # dáta za obdobie
        since = (datetime.utcnow() - timedelta(weeks=weeks + 1)).date().isoformat()
        res = (supabase.table(TABLE_ACTIVITIES_SUMMARY)
               .select("date, sport_type:sport_type_fe, distance_m, moving_time_s, average_heartrate_bpm")
               .eq("user_id", user_id).gte("date", since).execute())
        rows = res.data or []

        def new_week():
            return {
                "trimp": 0.0,
                "trimp_run": 0.0, "trimp_ride": 0.0, "trimp_strength": 0.0, "trimp_skate": 0.0, "trimp_mixed": 0.0, "trimp_other": 0.0,
                "time_min": 0.0,
                "time_run_min": 0.0, "time_ride_min": 0.0, "time_strength_min": 0.0, "time_skate_min": 0.0, "time_mixed_min": 0.0, "time_other_min": 0.0,
                "km_total": 0.0,
                "km_run": 0.0, "km_ride": 0.0, "km_skate": 0.0, "km_mixed": 0.0,
                "day_trimp": defaultdict(float), "day_time": defaultdict(float), "day_km": defaultdict(float),
            }
        week_agg: dict[str, dict] = defaultdict(new_week)

        for r in rows:
            d_str = (r.get("date") or "")[:10]
            try:
                d = date.fromisoformat(d_str)
            except Exception:
                continue

            wk = week_key(d)
            dist_km = float(r.get("distance_m") or 0.0) / 1000.0
            bucket = sport_bucket(r.get("sport_type") or "", r.get("distance_m") or 0)

            time_min = float(r.get("moving_time_s") or 0.0) / 60.0
            avg_hr = r.get("average_heartrate_bpm")
            tr = compute_trimp(avg_hr, time_min, hr_max, rhr, sex)

            wa = week_agg[wk]
            wa["trimp"] += tr
            wa["time_min"] += time_min
            wa["km_total"] += dist_km

            iso = d.isoformat()
            wa["day_trimp"][iso] += tr
            wa["day_time"][iso] += time_min
            wa["day_km"][iso] += dist_km

            # split do suffixov
            if bucket == "run":
                wa["trimp_run"] += tr; wa["time_run_min"] += time_min; wa["km_run"] += dist_km
            elif bucket == "ride":
                wa["trimp_ride"] += tr; wa["time_ride_min"] += time_min; wa["km_ride"] += dist_km
            elif bucket == "strength":
                wa["trimp_strength"] += tr; wa["time_strength_min"] += time_min
            elif bucket == "skate":
                wa["trimp_skate"] += tr; wa["time_skate_min"] += time_min; wa["km_skate"] += dist_km
            elif bucket == "mixed":
                wa["trimp_mixed"] += tr; wa["time_mixed_min"] += time_min; wa["km_mixed"] += dist_km
            else:
                wa["trimp_other"] += tr; wa["time_other_min"] += time_min

        # výstup + indexy
        out_weeks = []
        for wk, wa in sorted(week_agg.items()):
            start, end = week_bounds(wk)
            mono_km,  strain_km  = monotony_and_strain(wa["day_km"],   start, wa["km_total"])
            mono_tm,  strain_tm  = monotony_and_strain(wa["day_time"], start, wa["time_min"])
            mono_tr,  strain_tr  = monotony_and_strain(wa["day_trimp"],start, wa["trimp"])

            out_weeks.append({
                "week": wk, "start": start.isoformat(), "end": end.isoformat(),
                "km_total": wa["km_total"], "km_run": wa["km_run"], "km_ride": wa["km_ride"], "km_skate": wa["km_skate"], "km_mixed": wa["km_mixed"],
                "time_min": wa["time_min"],
                "time_run_min": wa["time_run_min"], "time_ride_min": wa["time_ride_min"],
                "time_strength_min": wa["time_strength_min"], "time_skate_min": wa["time_skate_min"], "time_mixed_min": wa["time_mixed_min"], "time_other_min": wa["time_other_min"],
                "trimp": wa["trimp"],
                "trimp_run": wa["trimp_run"], "trimp_ride": wa["trimp_ride"], "trimp_strength": wa["trimp_strength"], "trimp_skate": wa["trimp_skate"], "trimp_mixed": wa["trimp_mixed"], "trimp_other": wa["trimp_other"],
                "monotony": {"km": mono_km, "time": mono_tm, "trimp": mono_tr},
                "strain":   {"km": strain_km, "time": strain_tm, "trimp": strain_tr},
            })

        return {
            "success": True,
            "weeks": [
                {
                    "week": w["week"], "start": w["start"], "end": w["end"],
                    "km_total": float(w["km_total"]), "km_run": float(w["km_run"]), "km_ride": float(w["km_ride"]), "km_skate": float(w["km_skate"]), "km_mixed": float(w["km_mixed"]),
                    "time_min": float(w["time_min"]), "time_run_min": float(w["time_run_min"]), "time_ride_min": float(w["time_ride_min"]),
                    "time_strength_min": float(w["time_strength_min"]), "time_skate_min": float(w["time_skate_min"]), "time_mixed_min": float(w["time_mixed_min"]), "time_other_min": float(w["time_other_min"]),
                    "trimp": float(w["trimp"]), "trimp_run": float(w["trimp_run"]), "trimp_ride": float(w["trimp_ride"]), "trimp_strength": float(w["trimp_strength"]), "trimp_skate": float(w["trimp_skate"]), "trimp_mixed": float(w["trimp_mixed"]), "trimp_other": float(w["trimp_other"]),
                    "monotony": {"km": float(w["monotony"]["km"]), "time": float(w["monotony"]["time"]), "trimp": float(w["monotony"]["trimp"])},
                    "strain":   {"km": float(w["strain"]["km"]),   "time": float(w["strain"]["time"]),   "trimp": float(w["strain"]["trimp"])},
                }
                for w in out_weeks
            ],
            "hr_used": {"sex": sex, "hr_max": hr_max, "rhr": rhr},
        }

    except Exception as e:
        print(f"[ANALYTICS] weekly failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))