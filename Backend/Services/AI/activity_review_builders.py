# Services/AI/activity_review_builders.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis

from Routes_DB.activities_summary import db_get_summary_for_activities
from Routes_DB.activities_enrichment import db_get_enrichment_for_activities

from Modules.Supabase.auth import AuthCtx


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None


def _to_int(x: Any) -> Optional[int]:
    try:
        if x is None or x == "":
            return None
        return int(x)
    except Exception:
        return None


def _canonical_sport(s: Any) -> str:
    if not s:
        return "other"
    v = str(s).lower()
    if v.startswith("run") or "run" in v or v in ("trail", "trail_run"):
        return "run"
    if v.startswith("ride") or v.startswith("cycle") or v.startswith("bike"):
        return "ride"
    if v.startswith("str") or "strength" in v or "gym" in v or "weights" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


def _parse_yyyy_mm_dd(s: Any) -> Optional[datetime]:
    try:
        if not s:
            return None
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _days_ago(date_str: Any) -> Optional[int]:
    dt = _parse_yyyy_mm_dd(date_str)
    if not dt:
        return None
    today = datetime.now(timezone.utc).date()
    d = (today - dt.date()).days
    return int(d) if d >= 0 else 0


def build_base_input(user_id: int, activity_id: int) -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "user": {"id": user_id},
        "activity": {
            "activity_id": activity_id,
            "days_ago": None,
            "sport": "other",
            "metrics": {},
            "zones": {"z1": None, "z2": None, "z3": None, "z4": None, "z5": None, "dominant_zone": None},
            "flags": {"is_hard": None, "is_long": None},
        },
        "context": {"recovery": None, "recent_load": None},
    }


def _to_int_safe(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(str(v))
    except Exception:
        return None


def _minify_recent_load_to_week_horizon(recent_load: Any) -> Any:
    if not isinstance(recent_load, dict):
        return recent_load

    weeks = recent_load.get("weeks")
    if not isinstance(weeks, list):
        return {"schema_version": recent_load.get("schema_version"), "window_days": recent_load.get("window_days"), "weeks": []}

    keep_idx = {-1, 0}
    out_weeks: List[Dict[str, Any]] = []

    for w in weeks:
        if not isinstance(w, dict):
            continue
        idx = _to_int_safe(w.get("week_index_from_now"))
        if idx is None or idx not in keep_idx:
            continue
        out_weeks.append(
            {
                "week_index_from_now": idx,
                "week_start_iso": w.get("week_start_iso"),
                "week_end_iso": w.get("week_end_iso"),
                "run_minutes": w.get("run_minutes"),
                "total_minutes": w.get("total_minutes"),
                "hard_sessions": w.get("hard_sessions"),
                "strength_sessions": w.get("strength_sessions"),
            }
        )

    out_weeks.sort(key=lambda x: int(x.get("week_index_from_now", 0)))
    return {"schema_version": recent_load.get("schema_version"), "window_days": recent_load.get("window_days"), "weeks": out_weeks}


def _build_activity_block_from_rows(
    *,
    activity_id: int,
    summary_row: Dict[str, Any],
    enr_row: Dict[str, Any],
) -> Dict[str, Any]:
    dt_raw = str(summary_row.get("date") or "")
    date_str = dt_raw[:10] if dt_raw else None

    sport_src = summary_row.get("sport_type_fe") or summary_row.get("sport_type")
    sport = _canonical_sport(sport_src)

    dist_m = _to_float(summary_row.get("distance_m"))
    moving_s = _to_float(summary_row.get("moving_time_s"))
    elev_gain_m = _to_float(summary_row.get("elevation_gain_m"))
    avg_hr = _to_int(summary_row.get("average_heartrate_bpm"))
    max_hr = _to_int(summary_row.get("max_heartrate_bpm"))

    dur_min = (moving_s / 60.0) if (moving_s and moving_s > 0) else None
    dist_km = (dist_m / 1000.0) if (dist_m and dist_m > 0) else None
    pace_s_per_km = _to_int(summary_row.get("pace_seconds_per_km"))

    z1 = _to_float(enr_row.get("z1_min"))
    z2 = _to_float(enr_row.get("z2_min"))
    z3 = _to_float(enr_row.get("z3_min"))
    z4 = _to_float(enr_row.get("z4_min"))
    z5 = _to_float(enr_row.get("z5_min"))

    zones_min = {"z1": z1, "z2": z2, "z3": z3, "z4": z4, "z5": z5}

    dominant_zone = None
    best_val = -1.0
    for k, v in zones_min.items():
        if v is None:
            continue
        if float(v) > best_val:
            best_val = float(v)
            dominant_zone = k.upper()

    is_long = True if (dur_min is not None and dur_min >= 75) else False
    is_hard = True if ((z4 or 0.0) + (z5 or 0.0)) >= 12.0 else False

    return {
        "activity_id": activity_id,
        "days_ago": _days_ago(date_str),
        "sport": sport,
        "metrics": {
            "date": date_str,
            "distance_km": dist_km,
            "duration_min": dur_min,
            "pace_s_per_km": pace_s_per_km,
            "avg_hr": avg_hr,
            "max_hr": max_hr,
            "elevation_gain_m": elev_gain_m,
        },
        "zones": {**zones_min, "dominant_zone": dominant_zone},
        "flags": {"is_hard": is_hard, "is_long": is_long},
    }


def build_input_from_db(
    user_id: int,
    *,
    activity_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    input_data = build_base_input(user_id, activity_id)

    recovery = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
    recent_load_raw = service_build_recent_load_block_for_analysis(user_id=user_id, window_days=14, ctx=ctx)
    recent_load = _minify_recent_load_to_week_horizon(recent_load_raw)

    input_data["context"]["recovery"] = recovery
    input_data["context"]["recent_load"] = recent_load

    summary_rows = db_get_summary_for_activities(user_id=user_id, activity_ids=[activity_id], ctx=ctx) or []
    enr_rows = db_get_enrichment_for_activities(user_id=user_id, activity_ids=[activity_id], ctx=ctx) or []

    summary_row = summary_rows[0] if summary_rows else None
    enr_row = enr_rows[0] if enr_rows and isinstance(enr_rows[0], dict) else {}

    if not isinstance(summary_row, dict):
        return input_data

    input_data["activity"] = _build_activity_block_from_rows(
        activity_id=activity_id,
        summary_row=summary_row,
        enr_row=enr_row if isinstance(enr_row, dict) else {},
    )

    return input_data