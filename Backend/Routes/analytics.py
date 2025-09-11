from fastapi import APIRouter, HTTPException
from datetime import date, datetime, timedelta
from collections import defaultdict
import math, statistics

from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,  # "activities_summary"
    TABLE_USERS_STATIC,        # "users_static"
    TABLE_USERS_METRICS,       # "users_metrics"
)

router = APIRouter(prefix="/analytics", tags=["analytics"])
supabase = get_client()


# --------- helpers ---------

def sport_bucket(s: str) -> str:
    """Zaradí sport_type do štyroch skupín: run / ride / strength / other."""
    s = (s or "").lower()
    if "run" in s:          # run, trail_run
        return "run"
    if "ride" in s or "bike" in s or "cycle" in s:
        return "ride"
    if any(k in s for k in ["strength", "weight", "gym"]):
        return "strength"
    return "other"  # walk, hike, swim, yoga, ...

def week_key(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"

def week_bounds(iso_key: str) -> tuple[date, date]:
    y = int(iso_key.split("-W")[0])
    w = int(iso_key.split("-W")[1])
    start = date.fromisocalendar(y, w, 1)
    end = start + timedelta(days=6)
    return start, end

def compute_trimp(avg_hr: float | None,
                  dur_min: float,
                  hr_max: float | None,
                  rhr: float | None,
                  sex: str | None) -> float:
    """
    Banister TRIMP (sex-špecifické koeficienty).
    TRIMP = duration_min * HRr * k * exp(c * HRr)
    kde HRr = (HRavg - HRrest) / (HRmax - HRrest)
    """
    try:
        if not avg_hr or not hr_max or not rhr:
            return 0.0
        denom = (hr_max - rhr)
        if denom <= 0:
            return 0.0
        hrr = (avg_hr - rhr) / denom
        if hrr <= 0:
            return 0.0

        if (sex or "").upper() == "F":
            k, c = 0.86, 1.67
        else:
            k, c = 0.64, 1.92

        return float(dur_min * hrr * k * math.exp(c * hrr))
    except Exception:
        return 0.0

def monotony_and_strain(day_dict: dict[str, float],
                        week_start: date,
                        week_total: float) -> tuple[float, float]:
    """Foster: monotony = mean/SD zo 7 dní (vrátane nulových), strain = total * monotony."""
    vals = []
    for i in range(7):
        d = (week_start + timedelta(days=i)).isoformat()
        vals.append(float(day_dict.get(d, 0.0)))
    mean = statistics.fmean(vals) if vals else 0.0
    sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
    mono = (mean / sd) if sd > 0 else 0.0
    return mono, week_total * mono
# -------------------------------------------


@router.get("/weekly/{user_id}")
def weekly(user_id: int, weeks: int = 12):
    """
    Týždenná agregácia za posledných N týždňov.
    - Stĺpce (stĺpce/stacky): TRIMP / čas / km (so splitmi podľa športu)
    - Krivky: Monotony, Strain (pre každú metriku zvlášť)
    """
    try:
        # --- načítaj sex + aktuálne HR parametre (HRmax, RHR) ---
        sex = None
        hr_max = None
        rhr = None

        st = (
            supabase.table(TABLE_USERS_STATIC)
            .select("sex")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if st.data:
            sex = st.data[0].get("sex")

        mt = (
            supabase.table(TABLE_USERS_METRICS)
            .select("HR_max,RHR,updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if mt.data:
            hr_max = mt.data[0].get("HR_max")
            rhr = mt.data[0].get("RHR")

        # --- načítaj aktivity za obdobie ---
        since = (datetime.utcnow() - timedelta(weeks=weeks + 1)).date().isoformat()
        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("date,sport_type,distance_m,moving_time_s,average_heartrate_bpm")
            .eq("user_id", user_id)
            .gte("date", since)
            .execute()
        )
        rows = res.data or []
        print(f"[ANALYTICS] weekly: fetched rows={len(rows)} since={since}")

        # --- agregácia do týždňov ---
        week_agg: dict[str, dict] = defaultdict(lambda: {
            "trimp": 0.0, "trimp_run": 0.0, "trimp_ride": 0.0, "trimp_strength": 0.0, "trimp_other": 0.0,
            "time_min": 0.0, "time_run_min": 0.0, "time_ride_min": 0.0, "time_strength_min": 0.0, "time_other_min": 0.0,
            "km_total": 0.0, "km_run": 0.0, "km_ride": 0.0,
            # na výpočet monotony (po dňoch)
            "day_trimp": defaultdict(float),
            "day_time": defaultdict(float),
            "day_km": defaultdict(float),
        })

        for r in rows:
            d_str = (r.get("date") or "")[:10]
            try:
                d = date.fromisoformat(d_str)
            except Exception:
                continue

            wk = week_key(d)
            bucket = sport_bucket(r.get("sport_type") or "")

            dist_km = float(r.get("distance_m") or 0.0) / 1000.0
            time_min = float(r.get("moving_time_s") or 0.0) / 60.0
            avg_hr = r.get("average_heartrate_bpm")

            tr = compute_trimp(avg_hr, time_min, hr_max, rhr, sex)

            wa = week_agg[wk]
            # totaly
            wa["trimp"] += tr
            wa["time_min"] += time_min
            wa["km_total"] += dist_km
            # dňové koše
            wa["day_trimp"][d.isoformat()] += tr
            wa["day_time"][d.isoformat()] += time_min
            wa["day_km"][d.isoformat()] += dist_km
            # splity
            if bucket == "run":
                wa["trimp_run"] += tr
                wa["time_run_min"] += time_min
                wa["km_run"] += dist_km
            elif bucket == "ride":
                wa["trimp_ride"] += tr
                wa["time_ride_min"] += time_min
                wa["km_ride"] += dist_km
            elif bucket == "strength":
                wa["trimp_strength"] += tr
                wa["time_strength_min"] += time_min
            else:
                wa["trimp_other"] += tr
                wa["time_other_min"] += time_min

        # --- dopočítaj monotony/strain pre každý týždeň ---
        out_weeks = []
        for wk in sorted(week_agg.keys()):
            start, end = week_bounds(wk)
            wa = week_agg[wk]

            mono_km,  strain_km  = monotony_and_strain(wa["day_km"],   start, wa["km_total"])
            mono_tm,  strain_tm  = monotony_and_strain(wa["day_time"], start, wa["time_min"])
            mono_tr,  strain_tr  = monotony_and_strain(wa["day_trimp"],start, wa["trimp"])

            out_weeks.append({
                "week": wk,
                "start": start.isoformat(),
                "end": end.isoformat(),
                # súhrny
                "km_total": wa["km_total"], "km_run": wa["km_run"], "km_ride": wa["km_ride"],
                "time_min": wa["time_min"], "time_run_min": wa["time_run_min"], "time_ride_min": wa["time_ride_min"],
                "time_strength_min": wa["time_strength_min"], "time_other_min": wa["time_other_min"],
                "trimp": wa["trimp"], "trimp_run": wa["trimp_run"], "trimp_ride": wa["trimp_ride"],
                "trimp_strength": wa["trimp_strength"], "trimp_other": wa["trimp_other"],
                # metriky monotony/strain
                "monotony": {"km": mono_km, "time": mono_tm, "trimp": mono_tr},
                "strain":   {"km": strain_km, "time": strain_tm, "trimp": strain_tr},
            })

        print(f"[ANALYTICS] weekly: weeks={len(out_weeks)} "
              f"(sex={sex}, HRmax={hr_max}, RHR={rhr})")

        return {
            "success": True,
            "weeks": out_weeks,
            "hr_used": {"sex": sex, "hr_max": hr_max, "rhr": rhr},
        }

    except Exception as e:
        print(f"[ANALYTICS] weekly failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))