# backend/Modules/SQL/data_manager_ai.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict, Any
from collections import defaultdict
import math, statistics
import json

from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
    TABLE_USERS_PROFILE,
    TABLE_USERS_ZONES,
    TABLE_USERS_THRESHOLDS,
    TABLE_USERS_BESTS,
    TABLE_USERS_RECOVERY,
)

# Supabase / DB client
supabase = get_client()

# -------------------------
# Helpery pre týždňové aggregáty
# -------------------------
def week_key(d: date) -> str:
    """Vracia ISO week key, napr. '2025-W33'."""
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"

def week_bounds(iso_key: str) -> tuple[date, date]:
    """Z iso týždenného kľúča vráti start/end date (pondelok..nedeľa)."""
    try:
        y = int(iso_key.split("-W")[0])
        w = int(iso_key.split("-W")[1])
        start = date.fromisocalendar(y, w, 1)
        end = start + timedelta(days=6)
        return start, end
    except Exception as e:
        print(f"[data_manager_ai.week_bounds] parse error for {iso_key}: {e}")
        # fallback na dnešný týždeň
        today = datetime.utcnow().date()
        wk = week_key(today)
        s = date.fromisocalendar(today.isocalendar().year, today.isocalendar().week, 1)
        return s, s + timedelta(days=6)

def sport_bucket(s: str) -> str:
    """Znormalizuje sport_type do jednej z (run, bike, strength, other)."""
    s = (s or "").lower()
    if "run" in s:
        return "run"
    if "ride" in s or "bike" in s or "cycle" in s:
        return "bike"
    if any(k in s for k in ["strength", "weight", "gym"]):
        return "strength"
    return "other"

def compute_trimp(avg_hr: float | None, dur_min: float, hr_max: float | None, rhr: float | None, sex: str | None) -> float:
    """
    Banister TRIMP approximation.
    TRIMP = duration_min * HRr * k * exp(c * HRr)
    """
    try:
        if avg_hr is None or hr_max is None or rhr is None:
            return 0.0
        denom = (hr_max - rhr)
        if denom <= 0:
            return 0.0
        hrr = (float(avg_hr) - float(rhr)) / denom
        if hrr <= 0:
            return 0.0
        if (sex or "").upper() == "F":
            k, c = 0.86, 1.67
        else:
            k, c = 0.64, 1.92
        return float(dur_min * hrr * k * math.exp(c * hrr))
    except Exception as e:
        print(f"[compute_trimp] error: {e}")
        return 0.0

# -------------------------
# Základné AI-dátové query funkcie
# -------------------------
def ai_get_last_week_summary_data(user_id: int) -> List[Dict[str, Any]]:
    """
    Načíta aktivity za posledných 7 dní pre daného usera vrátane splits/laps.
    """
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", week_ago.isoformat())
            .order("date", desc=True)
            .execute()
        )
        summaries = resp.data or []
    except Exception as e:
        print(f"[ai_get_last_week_summary_data] fetch error: {e}")
        summaries = []

    activities: List[Dict[str, Any]] = []
    for s in summaries:
        aid = s.get("activity_id")
        try:
            splits = (
                supabase.table(TABLE_ACTIVITIES_SPLITS)
                .select("*")
                .eq("user_id", user_id)
                .eq("activity_id", aid)
                .execute()
            ).data or []
        except Exception:
            splits = []

        try:
            laps = (
                supabase.table(TABLE_ACTIVITIES_LAPS)
                .select("*")
                .eq("user_id", user_id)
                .eq("activity_id", aid)
                .execute()
            ).data or []
        except Exception:
            laps = []

        activities.append({"summary": s, "splits": splits, "laps": laps})

    return activities

def ai_get_activities_summary_in_range(user_id: int, start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """Vráti všetky riadky z activities_summary pre usera v danom intervale."""
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date)
            .lt("date", end_date)
            .order("date", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_activities_summary_in_range] error: {e}")
        return []

def ai_get_activity_summary(user_id: int, activity_id: int) -> Dict[str, Any] | None:
    """Vráti jednu aktivitu podľa activity_id."""
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )
        return (resp.data or [None])[0]
    except Exception as e:
        print(f"[ai_get_activity_summary] error: {e}")
        return None

def ai_get_user_profile(user_id: int) -> Dict[str, Any] | None:
    """Vráti profil používateľa (výška, váha, VO2max, birth_date atď.)."""
    try:
        resp = (
            supabase.table(TABLE_USERS_PROFILE)
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return (resp.data or [None])[0]
    except Exception as e:
        print(f"[ai_get_user_profile] error: {e}")
        return None

def ai_get_user_thresholds(user_id: int) -> List[Dict[str, Any]]:
    """Vráti prahy (LTHR, FTP, ...)."""
    try:
        resp = (
            supabase.table(TABLE_USERS_THRESHOLDS)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_user_thresholds] error: {e}")
        return []

def ai_get_user_zones(user_id: int) -> List[Dict[str, Any]]:
    """Vráti HR/pace/watt zóny používateľa."""
    try:
        resp = (
            supabase.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_user_zones] error: {e}")
        return []

def ai_get_user_bests(user_id: int) -> List[Dict[str, Any]]:
    """Vráti osobné bests používateľa."""
    try:
        resp = (
            supabase.table(TABLE_USERS_BESTS)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_user_bests] error: {e}")
        return []

def ai_get_user_recovery(user_id: int, from_date: str, to_date: str) -> List[Dict[str, Any]]:
    """
    Vráti recovery dáta (HRV, RHR, spánok, atď.) medzi from_date a to_date (ISO stringy).
    """
    try:
        resp = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", from_date)
            .lte("date", to_date)
            .order("date", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_user_recovery] error: {e}")
        return []

# -------------------------
# Laps / Splits helpers
# -------------------------
def ai_get_activity_laps(user_id: int, activity_id: int) -> List[Dict[str, Any]]:
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .order("lap_index", desc=False)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_activity_laps] error: {e}")
        return []

def ai_get_activity_splits(user_id: int, activity_id: int) -> List[Dict[str, Any]]:
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .order("split_index", desc=False)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[ai_get_activity_splits] error: {e}")
        return []

def ai_get_full_activity_bundle(user_id: int, activity_id: int) -> Dict[str, Any]:
    """Vráti summary + laps + splits pre jednu aktivitu."""
    try:
        summary = ai_get_activity_summary(user_id, activity_id)
        laps = ai_get_activity_laps(user_id, activity_id)
        splits = ai_get_activity_splits(user_id, activity_id)
        return {"summary": summary, "laps": laps, "splits": splits}
    except Exception as e:
        print(f"[ai_get_full_activity_bundle] error: {e}")
        return {}

# -------------------------
# Aggregácia: týždenné zhrnutie (hlavná funkcia, používaná v coach routeri)
# -------------------------
def fetch_weekly(user_id: int, weeks: int = 12):
    """
    Aggreguje aktivity do týždňov (posledných `weeks` týždňov).
    Vracia: { "weeks": [ ... ], "hr_used": {...} }
    """
    # načítaj profilové HR parametre (tolerantné)
    sex, hr_max, rhr = None, None, None
    try:
        st = supabase.table(TABLE_USERS_PROFILE).select("sex").eq("user_id", user_id).limit(1).execute()
        if st.data:
            sex = st.data[0].get("sex")
    except Exception as e:
        print(f"[fetch_weekly] users_profile fetch error: {e}")

    # pokus načítať HR max/RHR z TABLE_USERS_ZONES alebo metrics (záleží čo máš)
    try:
        mt = supabase.table(TABLE_USERS_ZONES).select("hr_max,rhr,updated_at").eq("user_id", user_id).order("updated_at", desc=True).limit(1).execute()
        if mt.data and len(mt.data) > 0:
            hr_max = mt.data[0].get("hr_max") or mt.data[0].get("HR_max")
            rhr = mt.data[0].get("rhr") or mt.data[0].get("RHR")
    except Exception:
        # nie kritické, len fallback
        pass

    since = (datetime.utcnow() - timedelta(weeks=weeks + 1)).date().isoformat()
    try:
        res = supabase.table(TABLE_ACTIVITIES_SUMMARY).select(
            "date,sport_type,distance_m,moving_time_s,average_heartrate_bpm,average_hr,name,activity_id"
        ).eq("user_id", user_id).gte("date", since).execute()
        rows = res.data or []
    except Exception as e:
        print(f"[fetch_weekly] activities fetch error: {e}")
        rows = []

    # inicializácia agregátu
    week_agg: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "trimp": 0.0, "trimp_run": 0.0, "trimp_bike": 0.0, "trimp_strength": 0.0, "trimp_other": 0.0,
        "time_min": 0.0, "time_run_min": 0.0, "time_bike_min": 0.0, "time_strength_min": 0.0, "time_other_min": 0.0,
        "km_total": 0.0, "km_run": 0.0, "km_bike": 0.0,
        "day_trimp": defaultdict(float), "day_time": defaultdict(float), "day_km": defaultdict(float),
        "examples": []
    })

    for r in rows:
        d_str = (r.get("date") or "")[:10]
        try:
            d = date.fromisoformat(d_str)
        except Exception:
            # ignoruj neplatné dátumy
            continue

        wk = week_key(d)
        bucket = sport_bucket(r.get("sport_type") or r.get("name") or "")
        dist_km = float(r.get("distance_m") or 0.0) / 1000.0
        time_min = float(r.get("moving_time_s") or 0.0) / 60.0
        avg_hr = r.get("average_heartrate_bpm") or r.get("average_hr")
        tr = compute_trimp(avg_hr, time_min, hr_max, rhr, sex)

        wa = week_agg[wk]
        wa["trimp"] += tr
        wa["time_min"] += time_min
        wa["km_total"] += dist_km
        wa["day_trimp"][d.isoformat()] += tr
        wa["day_time"][d.isoformat()] += time_min
        wa["day_km"][d.isoformat()] += dist_km

        if bucket == "run":
            wa["trimp_run"] += tr
            wa["time_run_min"] += time_min
            wa["km_run"] += dist_km
        elif bucket == "bike":
            wa["trimp_bike"] += tr
            wa["time_bike_min"] += time_min
            wa["km_bike"] += dist_km
        elif bucket == "strength":
            wa["trimp_strength"] += tr
            wa["time_strength_min"] += time_min
        else:
            wa["trimp_other"] += tr
            wa["time_other_min"] += time_min

        if len(wa["examples"]) < 6:
            wa["examples"].append({"date": d_str, "sport": r.get("sport_type"), "name": r.get("name"), "id": r.get("activity_id")})

    # zostav výstupné týždne (sorted)
    out_weeks: List[Dict[str, Any]] = []
    for wk in sorted(week_agg.keys()):
        start, end = week_bounds(wk)
        wa = week_agg[wk]

        # monotony/strain výpočty (KM, time, trimp)
        def monotony_and_strain(day_dict: Dict[str, float], week_start: date, week_total: float) -> tuple[float, float]:
            vals = []
            for i in range(7):
                d_iso = (week_start + timedelta(days=i)).isoformat()
                vals.append(float(day_dict.get(d_iso, 0.0)))
            mean = statistics.fmean(vals) if vals else 0.0
            sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
            mono = (mean / sd) if sd > 0 else 0.0
            return mono, week_total * mono

        mono_km, strain_km = monotony_and_strain(wa["day_km"], start, wa["km_total"])
        mono_tm, strain_tm = monotony_and_strain(wa["day_time"], start, wa["time_min"])
        mono_tr, strain_tr = monotony_and_strain(wa["day_trimp"], start, wa["trimp"])

        out_weeks.append({
            "week": wk,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "km_total": float(wa["km_total"]),
            "km_run": float(wa["km_run"]),
            "km_bike": float(wa["km_bike"]),
            "time_min": float(wa["time_min"]),
            "time_run_min": float(wa["time_run_min"]),
            "time_bike_min": float(wa["time_bike_min"]),
            "time_strength_min": float(wa["time_strength_min"]),
            "time_other_min": float(wa["time_other_min"]),
            "trimp": float(wa["trimp"]),
            "trimp_run": float(wa["trimp_run"]),
            "trimp_bike": float(wa["trimp_bike"]),
            "trimp_strength": float(wa["trimp_strength"]),
            "trimp_other": float(wa["trimp_other"]),
            "monotony": {"km": float(mono_km), "time": float(mono_tm), "trimp": float(mono_tr)},
            "strain": {"km": float(strain_km), "time": float(strain_tm), "trimp": float(strain_tr)},
            "examples": wa["examples"],
        })

    return {"weeks": out_weeks, "hr_used": {"sex": sex, "hr_max": hr_max, "rhr": rhr}}

# -------------------------
# Recovery / notes fetch
# -------------------------
def fetch_recent_recovery(user_id: int, days: int = 21):
    try:
        since = (datetime.utcnow().date() - timedelta(days=days)).isoformat()
        res = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("date,RHR_bpm,HRV_avg_ms,sleep_duration_min,food_2h_before,caffeine_8h,alcohol_volume_ml")
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[fetch_recent_recovery] error: {e}")
        return []

def fetch_recent_notes(user_id: int, days: int = 28):
    try:
        since_dt = datetime.utcnow() - timedelta(days=days)
        res = (
            supabase.table(TABLE_USERS_PROFILE.replace("profile","notes") if hasattr(TABLE_USERS_PROFILE,'replace') else "users_notes")
            .select("activity_id,feeling,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_dt.isoformat())
            .order("created_at", desc=False)
            .execute()
        )
        # Note: above line tries to be tolerant; if your config has TABLE_USERS_NOTES use that instead.
        return res.data or []
    except Exception:
        # fallback to explicit notes table if exists
        try:
            res = (
                supabase.table("users_notes")
                .select("activity_id,feeling,created_at")
                .eq("user_id", user_id)
                .gte("created_at", since_dt.isoformat())
                .order("created_at", desc=False)
                .execute()
            )
            return res.data or []
        except Exception as e:
            print(f"[fetch_recent_notes] error: {e}")
            return []
