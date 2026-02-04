# Services/AI/activity_review_builders.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Literal, Tuple

from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis

from Routes_DB.activities_summary import db_get_summary_for_activities
from Routes_DB.activities_enrichment import db_get_enrichment_for_activities

from Services.users import require_jwt

DebugLevel = Literal["none", "basic", "db", "full"]


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
    """
    Minimal stable shape for activity review.
    Horizon: ~1 week (recovery + recent load + activity metrics).
    """
    return {
        "schema_version": 1,
        "user": {"id": user_id},
        "activity": {
            "activity_id": activity_id,
            "days_ago": None,
            "sport": "other",
            "metrics": {},
            "zones": {
                "z1": None, "z2": None, "z3": None, "z4": None, "z5": None,
                "dominant_zone": None
            },
            "flags": {"is_hard": None, "is_long": None},
        },
        "context": {
            "recovery": None,
            "recent_load": None,
        },
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
        return {
            "schema_version": recent_load.get("schema_version"),
            "window_days": recent_load.get("window_days"),
            "weeks": [],
        }

    keep_idx = {-1, 0}  # last week + current week
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

    return {
        "schema_version": recent_load.get("schema_version"),
        "window_days": recent_load.get("window_days"),
        "weeks": out_weeks,
    }


def _pick(d: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k in keys:
        if k in d:
            out[k] = d.get(k)
    return out


def _debug_row_meta(rows: Any) -> Dict[str, Any]:
    if not isinstance(rows, list):
        return {"rows_type": type(rows).__name__, "rows_len": None}
    first = rows[0] if rows else None
    return {
        "rows_len": len(rows),
        "first_type": type(first).__name__ if first is not None else None,
        "first_keys": sorted(list(first.keys())) if isinstance(first, dict) else None,
    }


def _build_activity_block_from_rows(
    *,
    activity_id: int,
    summary_row: Dict[str, Any],
    enr_row: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build compact activity block:
    - only metrics that influence evaluation
    - zones (minutes) from enrichment
    - flags (hard/long)
    """
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

    # enrichment zone minutes
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

    # flags
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
    activity_id: int,
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
    debug: bool = False,
    debug_level: DebugLevel = "basic",
) -> Dict[str, Any]:
    """
    Minimal activity review input (1-week horizon):

    context:
      - recovery (HRV/RHR/sleep/trend)
      - recent_load (minified to last+current week)
    activity:
      - metrics + zones minutes + flags

    Debug:
      - basic: add high-level trace (counts)
      - db: include DB rows meta + previews
      - full: include safe full rows (still scrubbed to selected keys)
    """
    jwt = None if service else require_jwt(user_jwt)

    input_data = build_base_input(user_id, activity_id)

    # internal debug container (never relied upon by prompts)
    dbg: Dict[str, Any] = {}
    if debug and debug_level != "none":
        dbg["debug_level"] = debug_level
        dbg["service"] = service
        dbg["user_id"] = user_id
        dbg["activity_id"] = activity_id

    # --- context blocks ---
    recovery = service_build_recovery_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )
    input_data["context"]["recovery"] = recovery

    recent_load_raw = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=14,
        user_jwt=jwt,
        service=service,
    )
    input_data["context"]["recent_load"] = _minify_recent_load_to_week_horizon(recent_load_raw)

    if debug and debug_level in ("basic", "db", "full"):
        dbg["context_recovery_present"] = isinstance(recovery, dict) and bool(recovery)
        dbg["context_recent_load_present"] = isinstance(recent_load_raw, dict) and bool(recent_load_raw)

        if isinstance(recovery, dict):
            dbg["context_recovery_keys"] = sorted(list(recovery.keys()))

        if isinstance(recent_load_raw, dict):
            dbg["recent_load_raw_keys"] = sorted(list(recent_load_raw.keys()))
            weeks = recent_load_raw.get("weeks")
            dbg["recent_load_raw_weeks_len"] = len(weeks) if isinstance(weeks, list) else None

    # --- activity rows (DB) ---
    summary_rows = db_get_summary_for_activities(
        user_id=user_id,
        activity_ids=[activity_id],
        user_jwt=jwt,
        service=service,
    ) or []

    enr_rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=[activity_id],
        user_jwt=jwt,
        service=service,
    ) or []

    if debug and debug_level in ("basic", "db", "full"):
        dbg["db_summary_meta"] = _debug_row_meta(summary_rows)
        dbg["db_enrichment_meta"] = _debug_row_meta(enr_rows)

    summary_row = summary_rows[0] if summary_rows else None
    enr_row = enr_rows[0] if (enr_rows and isinstance(enr_rows[0], dict)) else {}

    # If summary missing, keep base shape.
    if not isinstance(summary_row, dict):
        if debug and debug_level in ("db", "full"):
            dbg["db_summary_preview"] = (
                summary_row if summary_row is None else {"type": type(summary_row).__name__}
            )
            # helpful hint: show what activity_id you asked for
            dbg["note"] = "summary_row_missing_or_invalid -> activity block not built"
        if debug and debug_level != "none":
            input_data["_debug"] = dbg
        return input_data

    # DB previews
    if debug and debug_level in ("db", "full"):
        # show a safe preview of what we actually expect to use
        dbg["db_summary_preview"] = _pick(
            summary_row,
            [
                "date",
                "sport_type",
                "sport_type_fe",
                "distance_m",
                "moving_time_s",
                "pace_seconds_per_km",
                "average_heartrate_bpm",
                "max_heartrate_bpm",
                "elevation_gain_m",
            ],
        )
        if isinstance(enr_row, dict):
            dbg["db_enrichment_preview"] = _pick(
                enr_row,
                ["z1_min", "z2_min", "z3_min", "z4_min", "z5_min"],
            )

        if debug_level == "full":
            # still not "full dump", but more keys
            dbg["db_summary_keys"] = sorted(list(summary_row.keys()))
            dbg["db_enrichment_keys"] = sorted(list(enr_row.keys())) if isinstance(enr_row, dict) else None

    # Build activity
    input_data["activity"] = _build_activity_block_from_rows(
        activity_id=activity_id,
        summary_row=summary_row,
        enr_row=enr_row if isinstance(enr_row, dict) else {},
    )

    if debug and debug_level in ("basic", "db", "full"):
        # show the final shape that goes to AI (activity + context only)
        dbg["final_activity_keys"] = sorted(list((input_data.get("activity") or {}).keys())) if isinstance(input_data.get("activity"), dict) else None
        dbg["final_activity_metrics"] = (input_data.get("activity") or {}).get("metrics") if isinstance(input_data.get("activity"), dict) else None
        dbg["final_activity_zones"] = (input_data.get("activity") or {}).get("zones") if isinstance(input_data.get("activity"), dict) else None

    if debug and debug_level != "none":
        input_data["_debug"] = dbg

    return input_data