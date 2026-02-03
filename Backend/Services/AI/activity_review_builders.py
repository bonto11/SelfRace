# Services/AI/activity_review_builders.py
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, List

from Services.profile_metrics import service_load_user_profile_for_analysis
from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.coach_plan_meta import service_build_active_plan_block_for_analysis

from Routes_DB.activities_summary import db_get_summary_for_activities
from Routes_DB.activities_enrichment import db_get_enrichment_for_activities

from Services.users import require_jwt


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


def _safe_div(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None or b == 0:
        return None
    try:
        return float(a) / float(b)
    except Exception:
        return None


def build_base_input(user_id: int, activity_id: int) -> Dict[str, Any]:
    """
    Minimal stable shape for activity review.
    """
    return {
        "schema_version": 1,
        "user": {"id": user_id},
        "activity": {
            "activity_id": activity_id,
            "days_ago": None,
            "sport": "other",
            "summary": {},
            "enrichment": {},
            "derived": {},
        },
        "context": {
            "prefs": None,
            "zones": None,
            "thresholds": None,
            "recent_load": None,
            "recovery": None,
            "active_plan": None,
        },
    }


def _build_activity_block_from_rows(
    *,
    activity_id: int,
    summary_row: Dict[str, Any],
    enr_row: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Z summary + enrichment spraví kompaktný blok s derived signálmi.
    Toto je to, čo AI fakt potrebuje.
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
    avg_cad = _to_float(summary_row.get("average_cadence_rpm"))
    avg_watts = _to_float(summary_row.get("average_watts"))

    dur_min = (moving_s / 60.0) if (moving_s and moving_s > 0) else None
    dist_km = (dist_m / 1000.0) if (dist_m and dist_m > 0) else None

    pace_s_per_km = _to_int(summary_row.get("pace_seconds_per_km"))
    avg_speed_mps = _to_float(summary_row.get("average_speed_mps"))

    # zóny z enrichment (tvoje existujúce stĺpce)
    z1 = _to_float(enr_row.get("z1_min"))
    z2 = _to_float(enr_row.get("z2_min"))
    z3 = _to_float(enr_row.get("z3_min"))
    z4 = _to_float(enr_row.get("z4_min"))
    z5 = _to_float(enr_row.get("z5_min"))

    z_total = None
    if any(v is not None for v in (z1, z2, z3, z4, z5)):
        z_total = sum(v or 0.0 for v in (z1, z2, z3, z4, z5))

    # percentá – robustne (ak chýba z_total, necháme None)
    def pct(z: Optional[float]) -> Optional[float]:
        if z is None or z_total is None or z_total <= 0:
            return None
        return round(100.0 * (z / z_total), 1)

    # jednoduché derived signály (bez streams):
    # - intensity_hint: podľa dominantnej zóny
    zone_minutes = {"z1": z1, "z2": z2, "z3": z3, "z4": z4, "z5": z5}
    dominant_zone = None
    best_val = -1.0
    for k, v in zone_minutes.items():
        if v is None:
            continue
        if float(v) > best_val:
            best_val = float(v)
            dominant_zone = k.upper()

    derived = {
        "duration_min": dur_min,
        "distance_km": dist_km,
        "pace_s_per_km": pace_s_per_km,
        "avg_speed_mps": avg_speed_mps,
        "avg_hr": avg_hr,
        "max_hr": max_hr,
        "avg_cadence": avg_cad,
        "avg_watts": avg_watts,
        "elevation_gain_m": elev_gain_m,
        "zones_min": zone_minutes,
        "zones_pct": {"z1": pct(z1), "z2": pct(z2), "z3": pct(z3), "z4": pct(z4), "z5": pct(z5)},
        "dominant_zone": dominant_zone,
        # heuristiky, ktoré sa hodia do promptu (AI si z toho spraví text):
        "is_long": True if (dur_min is not None and dur_min >= 75) else False,
        "is_hard": True if ((z4 or 0) + (z5 or 0)) >= 12 else False,  # hrubý signál
    }

    return {
        "activity_id": activity_id,
        "days_ago": _days_ago(date_str),
        "sport": sport,
        "summary": {
            # držme to krátke, ale nech sú tam základné metriky
            "date": date_str,
            "name": None,  # anonymizácia; ak chceš, vieš tu dať name
            "distance_m": dist_m,
            "moving_time_s": moving_s,
            "pace_seconds_per_km": pace_s_per_km,
            "average_heartrate_bpm": avg_hr,
            "max_heartrate_bpm": max_hr,
            "elevation_gain_m": elev_gain_m,
            "average_cadence_rpm": avg_cad,
            "average_watts": avg_watts,
        },
        "enrichment": {
            "z1_min": z1,
            "z2_min": z2,
            "z3_min": z3,
            "z4_min": z4,
            "z5_min": z5,
            # sem neskôr môžeš pridať: "effort_score", "trimp", "ai_review" atď.
        },
        "derived": derived,
    }


def build_input_from_db(
    user_id: int,
    activity_id: int,
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Activity review input:
      - user context (zones/thresholds/prefs/load/recovery/plan)
      - one activity: summary + enrichment + derived

    service=False -> RLS, vyžaduje JWT
    service=True  -> service client, JWT netreba
    """
    jwt = None if service else require_jwt(user_jwt)

    input_data = build_base_input(user_id, activity_id)

    # --- context blocks (keep minimal but useful) ---
    input_data["context"]["prefs"] = service_load_coach_prefs_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    input_data["context"]["zones"] = service_build_zones_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    input_data["context"]["thresholds"] = service_build_thresholds_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    input_data["context"]["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=42,
        user_jwt=jwt,
        service=service,
    )

    input_data["context"]["recovery"] = service_build_recovery_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    input_data["context"]["active_plan"] = service_build_active_plan_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # --- activity rows ---
    summary_rows = (
        db_get_summary_for_activities(
            user_id=user_id,
            activity_ids=[activity_id],
            user_jwt=jwt,
            service=service,
        )
        or []
    )
    summary_row = summary_rows[0] if summary_rows else None
    if not isinstance(summary_row, dict):
        # necháme base shape; AI aj tak zlyhá, ale máš konzistentný payload
        return input_data

    enr_rows = (
        db_get_enrichment_for_activities(
            user_id=user_id,
            activity_ids=[activity_id],
            user_jwt=jwt,
            service=service,
        )
        or []
    )
    enr_row = enr_rows[0] if enr_rows and isinstance(enr_rows[0], dict) else {}

    input_data["activity"] = _build_activity_block_from_rows(
        activity_id=activity_id,
        summary_row=summary_row,
        enr_row=enr_row,
    )

    # (Optional) user profile – len ak chceš, aby AI vedela napr. vek/sex/hmotnosť
    # input_data["user_profile"] = service_load_user_profile_for_analysis(...)

    return input_data