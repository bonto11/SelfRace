# Services/analytics_weekly.py
from __future__ import annotations

from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import Any, Dict, Optional, List

from Services.time import week_key, week_bounds
from Services.analytics_MonoStrainTrimp import (
    sport_bucket,
    compute_trimp,
    monotony_and_strain,
)

# --- UPRAVENÉ IMPORTY NA ZAČIATKU SÚBORU ---
from DB.activities_summary import db_fetch_summary_since
from DB.user_recovery import db_get_recent_recovery
from DB.profile_static import db_fetch_user_sex
from DB.user_metrics import db_get_latest_metric 
from Modules.Supabase.auth import AuthCtx

"""
    Týždenná agregácia za posledných N týždňov.

    - km/time/TRIMP rozdelené podľa: run, ride, strength, skate, mixed, other
    - Monotony/Strain k rovnakej metrike
    - HR parametre:
        * sex            -> profile_static.sex (db_fetch_user_sex)
        * HR_max         -> profile_metric (fetch_user_hr_max)
        * RHR (denné)    -> users_recovery.RHR_bpm (db_get_recent_recovery),
                            v kóde si spravíme mapu date -> rhr
                            a fallback o 1–2 dni dozadu, inak Edwards TRIMP.

    Režimy:
      - FE / RLS: service=False, user_jwt povinný → require_jwt
      - worker / cron: service=True, user_jwt môže byť None → DB vrstvy používajú service klienta
"""
def service_weekly_analytics(
    user_id: int,
    weeks: int = 12,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    
    # ---------------- HR parametre (sex, HR_max) ----------------
    sex: Optional[str] = db_fetch_user_sex(user_id, ctx=ctx)
    
    # ✅ NOVÝ SPÔSOB VYTIAHNUTIA HR_MAX cez nové DB API
    hr_row = db_get_latest_metric(user_id, "hr_max", ctx=ctx)
    hr_max: Optional[float] = float(hr_row["value_num"]) if hr_row and hr_row.get("value_num") else None

    # ---------------- časové okno ----------------
    since_date = (datetime.utcnow() - timedelta(weeks=weeks + 1)).date()
    since_iso = since_date.isoformat()

    # ---------------- Recovery RHR (date -> RHR_bpm) ----------------
    # máme funkciu "posledných N dní", tak zoberieme weeks*7 + buffer
    days_window = (weeks + 1) * 7
    recovery_rows: List[Dict[str, Any]] = db_get_recent_recovery(
        user_id=user_id,
        days=days_window,
        ctx=ctx,
    )

    rhr_by_date: Dict[str, float] = {}
    for rr in recovery_rows or []:
        d = (rr.get("date") or "")[:10]
        if not d:
            continue
        try:
            v = float(rr.get("RHR_bpm") or 0)
        except Exception:
            v = 0.0
        if v <= 0:
            continue
        # ak je viac záznamov v jeden deň, nechaj nižší (konzervatívne)
        if d not in rhr_by_date or v < rhr_by_date[d]:
            rhr_by_date[d] = v

    def rhr_for(iso_date: str) -> Optional[float]:
        """
        Vráť denný RHR; ak chýba, skús 1–2 dni dozadu.
        Ak stále nič, v compute_trimp sa použije fallback (Edwards).
        """
        if iso_date in rhr_by_date:
            return rhr_by_date[iso_date]
        try:
            d0 = date.fromisoformat(iso_date)
        except Exception:
            return None
        for back in (1, 2):
            d_prev = (d0 - timedelta(days=back)).isoformat()
            if d_prev in rhr_by_date:
                return rhr_by_date[d_prev]
        return None

    # ---------------- Aktivity za okno (summary) ----------------
    rows: List[Dict[str, Any]] = db_fetch_summary_since(
        user_id=user_id,
        since_iso=since_iso,
        ctx=ctx,
    )

    def new_week() -> Dict[str, Any]:
        return {
            "trimp": 0.0,
            "trimp_run": 0.0,
            "trimp_ride": 0.0,
            "trimp_strength": 0.0,
            "trimp_skate": 0.0,
            "trimp_mixed": 0.0,
            "trimp_other": 0.0,
            "time_min": 0.0,
            "time_run_min": 0.0,
            "time_ride_min": 0.0,
            "time_strength_min": 0.0,
            "time_skate_min": 0.0,
            "time_mixed_min": 0.0,
            "time_other_min": 0.0,
            "km_total": 0.0,
            "km_run": 0.0,
            "km_ride": 0.0,
            "km_skate": 0.0,
            "km_mixed": 0.0,
            # per-day agregácie pre monotóniu/strain
            "day_trimp": defaultdict(float),
            "day_time": defaultdict(float),
            "day_km": defaultdict(float),
        }

    week_agg: Dict[str, Dict[str, Any]] = defaultdict(new_week)

    for r in rows:
        d_str = (r.get("date") or "")[:10]
        try:
            d = date.fromisoformat(d_str)
        except Exception:
            continue

        wk = week_key(d)

        raw_type = (
            r.get("sport_type_ovrd")
            or r.get("sport_type_fe")
            or r.get("sport_type")
            or ""
        )

        dist_km = float(r.get("distance_m") or 0.0) / 1000.0
        bucket = sport_bucket(raw_type, dist_km) or "other"
        if bucket == "other" and dist_km > 0:
            bucket = "mixed"

        time_min = float(r.get("moving_time_s") or 0.0) / 60.0
        avg_hr = r.get("average_heartrate_bpm")

        rhr = rhr_for(d_str)  # môže byť None -> fallback Edwards v compute_trimp
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
        elif bucket == "skate":
            wa["trimp_skate"] += tr
            wa["time_skate_min"] += time_min
            wa["km_skate"] += dist_km
        elif bucket == "mixed":
            wa["trimp_mixed"] += tr
            wa["time_mixed_min"] += time_min
            wa["km_mixed"] += dist_km
        else:
            wa["trimp_other"] += tr
            wa["time_other_min"] += time_min

    # ---------------- výstup (monotony/strain + casting na float) ----------------
    out_weeks: List[Dict[str, Any]] = []
    for wk, wa in sorted(week_agg.items()):
        start, end = week_bounds(wk)

        mono_km, strain_km = monotony_and_strain(wa["day_km"], start, wa["km_total"])
        mono_tm, strain_tm = monotony_and_strain(wa["day_time"], start, wa["time_min"])
        mono_tr, strain_tr = monotony_and_strain(wa["day_trimp"], start, wa["trimp"])

        out_weeks.append(
            {
                "week": wk,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "km_total": wa["km_total"],
                "km_run": wa["km_run"],
                "km_ride": wa["km_ride"],
                "km_skate": wa["km_skate"],
                "km_mixed": wa["km_mixed"],
                "time_min": wa["time_min"],
                "time_run_min": wa["time_run_min"],
                "time_ride_min": wa["time_ride_min"],
                "time_strength_min": wa["time_strength_min"],
                "time_skate_min": wa["time_skate_min"],
                "time_mixed_min": wa["time_mixed_min"],
                "time_other_min": wa["time_other_min"],
                "trimp": wa["trimp"],
                "trimp_run": wa["trimp_run"],
                "trimp_ride": wa["trimp_ride"],
                "trimp_strength": wa["trimp_strength"],
                "trimp_skate": wa["trimp_skate"],
                "trimp_mixed": wa["trimp_mixed"],
                "trimp_other": wa["trimp_other"],
                "monotony": {
                    "km": mono_km,
                    "time": mono_tm,
                    "trimp": mono_tr,
                },
                "strain": {
                    "km": strain_km,
                    "time": strain_tm,
                    "trimp": strain_tr,
                },
            }
        )

    return {
        "weeks": [
            {
                "week": w["week"],
                "start": w["start"],
                "end": w["end"],
                "km_total": float(w["km_total"]),
                "km_run": float(w["km_run"]),
                "km_ride": float(w["km_ride"]),
                "km_skate": float(w["km_skate"]),
                "km_mixed": float(w["km_mixed"]),
                "time_min": float(w["time_min"]),
                "time_run_min": float(w["time_run_min"]),
                "time_ride_min": float(w["time_ride_min"]),
                "time_strength_min": float(w["time_strength_min"]),
                "time_skate_min": float(w["time_skate_min"]),
                "time_mixed_min": float(w["time_mixed_min"]),
                "time_other_min": float(w["time_other_min"]),
                "trimp": float(w["trimp"]),
                "trimp_run": float(w["trimp_run"]),
                "trimp_ride": float(w["trimp_ride"]),
                "trimp_strength": float(w["trimp_strength"]),
                "trimp_skate": float(w["trimp_skate"]),
                "trimp_mixed": float(w["trimp_mixed"]),
                "trimp_other": float(w["trimp_other"]),
                "monotony": {
                    "km": float(w["monotony"]["km"]),
                    "time": float(w["monotony"]["time"]),
                    "trimp": float(w["monotony"]["trimp"]),
                },
                "strain": {
                    "km": float(w["strain"]["km"]),
                    "time": float(w["strain"]["time"]),
                    "trimp": float(w["strain"]["trimp"]),
                },
            }
            for w in out_weeks
        ],
        "hr_used": {"sex": sex, "hr_max": hr_max},
    }