# Routes/coach_context.py
# Routes/coach_context.py
from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException
from datetime import date, datetime, timedelta, timezone, time
from collections import defaultdict
from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_PROFILE_STATIC,
    TABLE_PROFILE_METRIC_VALUE,
    TABLE_USERS_RECOVERY,
    TABLE_USERS_NOTES,
    TABLE_USERS_THRESHOLDS,
    TABLE_USERS_ZONES,
    TABLE_USERS_BESTS,
    TABLE_USER_PREFERENCES,
)
from Services.time import week_key, week_bounds
from Services.analytics import compute_trimp, monotony_and_strain
from Services.bests import fetch_user_bests

router = APIRouter(prefix="/coach", tags=["coach"])
supabase = get_client()


# ---------------------------- helpers (dates) -----------------------------

def _day_floor_utc(d: date) -> datetime:
    return datetime.combine(d, time(0, 0, 0, tzinfo=timezone.utc))

def _since_weeks_utc(weeks: int) -> datetime:
    # okno = (weeks + 1) pre bezpečný zásah do predchádzajúceho týždňa
    return _day_floor_utc((datetime.now(timezone.utc) - timedelta(weeks=weeks + 1)).date())


# ---------------------------- helpers (RHR / mapping) ---------------------

def _rhr_map_since(user_id: int, since_iso_ts: str) -> Dict[str, float]:
    """
    Vráti mapu { 'YYYY-MM-DD' -> RHR_bpm }, brané od since_iso_ts (UTC).
    """
    mp: Dict[str, float] = {}
    try:
        rec = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("date,RHR_bpm")
            .eq("user_id", user_id)
            .gte("date", since_iso_ts)  # date je u teba tiež timestampz → ISO OK
            .order("date", desc=False)
            .execute()
        )
        for rr in (rec.data or []):
            d = (rr.get("date") or "")[:10]
            try:
                v = float(rr.get("RHR_bpm") or 0)
            except Exception:
                v = 0.0
            if v <= 0:
                continue
            # ak duplicitné záznamy v jeden deň → vezmi nižší RHR (konzervatívne)
            if d not in mp or v < mp[d]:
                mp[d] = v
    except Exception:
        pass
    return mp

def _rhr_for_date(rhr_by_date: Dict[str, float], iso_date: str) -> Optional[float]:
    if iso_date in rhr_by_date:
        return rhr_by_date[iso_date]
    try:
        d0 = date.fromisoformat(iso_date)
    except Exception:
        return None
    for back in (1, 2):
        cand = (d0 - timedelta(days=back)).isoformat()
        if cand in rhr_by_date:
            return rhr_by_date[cand]
    return None


# ---------------------------- WEEKLY CONTEXT ------------------------------

def fetch_weekly(user_id: int, weeks: int = 12):
    # Profil – pohlavie a HR_max (na TRIMP)
    sex: Optional[str] = None
    hr_max: Optional[float] = None

    try:
        st = (
            supabase.table(TABLE_PROFILE_STATIC)
            .select("sex")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if st.data:
            sex = st.data[0].get("sex")
    except Exception:
        pass

    try:
        mt = (
            supabase.table(TABLE_PROFILE_METRIC_VALUE)
            .select("value_num")
            .eq("user_id", user_id)
            .eq("metric", "HR_max")
            .order("measured_at", desc=True)
            .limit(1)
            .execute()
        )
        if mt.data:
            v = float(mt.data[0].get("value_num") or 0)
            hr_max = v if v > 0 else None
    except Exception:
        pass

    # Časové okno len cez JEDEN stĺpec: date (timestamp with time zone)
    since_ts = _since_weeks_utc(weeks)
    since_iso = since_ts.isoformat()

    # RHR map pre okno
    rhr_by_date = _rhr_map_since(user_id, since_iso)

    # Aktivity – len polia, ktoré máš: date, sport_type(_fe/_ovrd), distance_m, moving_time_s, average_heartrate_bpm
    try:
        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "activity_id,name,"
                "sport_type,sport_type_fe,sport_type_ovrd,"
                "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
            )
            .eq("user_id", user_id)
            .gte("date", since_iso)
            .order("date", desc=True)
            .execute()
        )

        rows = res.data or []
    except Exception:
        rows = []


    # bucketovanie športov – jednoducho podľa stringu
    def _bucket(s: str) -> str:
        s = (s or "").lower()
        if "run" in s:
            return "run"
        if "ride" in s or "bike" in s or "cycle" in s:
            return "ride"
        if "strength" in s or "weight" in s or "gym" in s:
            return "strength"
        return "other"

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
        bucket = _bucket(raw_type)

        dist_km = float(r.get("distance_m") or 0.0) / 1000.0
        time_min = float(r.get("moving_time_s") or 0.0) / 60.0
        avg_hr = r.get("average_heartrate_bpm") or r.get("average_hr")

        rhr = _rhr_for_date(rhr_by_date, d_str)
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


# ---------------------------- RECENT CONTEXT PIECES -----------------------

def fetch_recent_recovery(user_id: int, days: int = 21):
    try:
        since = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
        res = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("date,RHR_bpm,HRV_avg_ms,sleep_duration_min,food_2h_before,caffeine_8h,alcohol_volume_ml")
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

def fetch_recent_notes(user_id: int, days: int = 28):
    try:
        since_dt = datetime.now(timezone.utc) - timedelta(days=days)
        res = (
            supabase.table(TABLE_USERS_NOTES)
            .select("activity_id,feeling,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_dt.isoformat())
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

def fetch_user_thresholds(user_id: int) -> list[dict]:
    try:
        res = (
            supabase.table(TABLE_USERS_THRESHOLDS)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

def fetch_user_zones(user_id: int) -> list[dict]:
    try:
        res = (
            supabase.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


# ---------------------------- BESTS & PREFS -------------------------------

STD_DISTANCES = [400, 1000, 5000, 21097, 42195]


def fetch_user_coach_prefs(user_id: int) -> dict | None:
    try:
        res = (
            supabase.table(TABLE_USER_PREFERENCES)
            .select("value")
            .eq("user_id", user_id)
            .eq("key", "coach.prefs")
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0]
        if not row:
            return None
        val = row.get("value")
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return None
        if isinstance(val, dict):
            return val
        return None
    except Exception:
        return None


# ---------------------------- PUBLIC ROUTE --------------------------------

@router.get("/context/{user_id}")
def coach_context(user_id: int, weeks: int = 6, rec_days: int = 21):
    try:
        weekly = fetch_weekly(user_id, weeks=weeks)
        recovery = fetch_recent_recovery(user_id, days=rec_days)
        notes = fetch_recent_notes(user_id, days=weeks * 7)
        thresholds = fetch_user_thresholds(user_id)
        zones = fetch_user_zones(user_id)
        prefs = fetch_user_coach_prefs(user_id)
        bests = fetch_user_bests(user_id, "run")
        return {
            "success": True,
            "weekly": weekly,
            "recovery": recovery,
            "notes": notes,
            "thresholds": thresholds,
            "zones": zones,
            "prefs": prefs,
            "bests": bests,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))