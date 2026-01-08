# Services/AI_Athhlete_State/coach_input_builder.py
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, List

from Services.profile_metrics import service_load_user_profile_for_analysis
from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_bests import service_build_bests_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.analytics_RecentLoad import (
    service_build_recent_load_block_for_analysis,
)
from Services.coach_external_events import (
    service_build_external_events_block_for_analysis,
)
from Services.coach_plan_meta import service_build_active_plan_block_for_analysis

from Routes_DB.activities_summary import (
    db_get_recent_activity_ids,
    db_get_summary_for_activities,
)
from Routes_DB.activities_enrichment import (
    db_get_enrichment_for_activities,
)

from Services.users import require_jwt


# -------------------- drobné helpery --------------------


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
    """
    Z DB labelu spraví jednoduchý sport code pre AI: run/ride/strength/swim/other.
    """
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


# -------------------- LAST ACTIVITIES BLOCK --------------------


def build_last_activities_block_for_analysis(
    user_id: int,
    *,
    user_jwt: Optional[str],
    service: bool = False,
    limit: int = 6,
) -> List[Dict[str, Any]]:
    """
    Vytiahne posledných N aktivít (summary + zóny z enrichment)
    a preloží ich do jednoduchého listu pre AI.

    - service=False → RLS klient (require_jwt),
    - service=True  → service klient (DB vrstva podľa `service=True`).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    if limit <= 0:
        limit = 4

    since_iso = (
        datetime.now(timezone.utc) - timedelta(days=60)
    ).date().isoformat()

    # 1) ID posledných aktivít
    ids = db_get_recent_activity_ids(
        user_id=user_id,
        since_iso_date=since_iso,
        limit=limit,
        user_jwt=jwt,
        service=service,
    )
    if not ids:
        return []

    # 2) summary pre tieto aktivity
    summary_rows = db_get_summary_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=jwt,
        service=service,
    ) or []

    if not summary_rows:
        return []

    # 3) enrichment – zóny pre tieto aktivity
    enr_rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=jwt,
        service=service,
    ) or []
    enr_by_id: Dict[int, Dict[str, Any]] = {}
    for r in enr_rows:
        aid = _to_int(r.get("activity_id"))
        if aid is not None:
            enr_by_id[aid] = r

    # 4) poskladáme výsledný list – zoradený podľa date desc
    def _date_key(row: Dict[str, Any]) -> str:
        return str(row.get("date") or "")[:19]

    out: List[Dict[str, Any]] = []

    for r in sorted(summary_rows, key=_date_key, reverse=True):
        aid = _to_int(r.get("activity_id"))
        if aid is None:
            continue

        dt_raw = str(r.get("date") or "")
        date_str = dt_raw[:10] if dt_raw else None

        moving_s = _to_float(r.get("moving_time_s"))
        dist_m = _to_float(r.get("distance_m"))
        avg_hr = _to_int(r.get("average_heartrate_bpm"))

        dur_min = moving_s / 60.0 if moving_s and moving_s > 0 else None
        dist_km = dist_m / 1000.0 if dist_m and dist_m > 0 else None

        sport_src = r.get("sport_type_fe") or r.get("sport_type")
        sport = _canonical_sport(sport_src)

        enr = enr_by_id.get(aid, {})

        out.append(
            {
                "activity_id": aid,
                "date": date_str,
                "sport": sport,
                "name": r.get("name"),
                "duration_min": dur_min,
                "distance_km": dist_km,
                "avg_hr": avg_hr,
                "z1_min": _to_float(enr.get("z1_min")),
                "z2_min": _to_float(enr.get("z2_min")),
                "z3_min": _to_float(enr.get("z3_min")),
                "z4_min": _to_float(enr.get("z4_min")),
                "z5_min": _to_float(enr.get("z5_min")),
            }
        )

    return out


# -------------------- BASE INPUT + BUILDER --------------------


def build_base_input(user_id: int) -> Dict[str, Any]:
    """
    Základný CoachAnalyzeInput skeleton.
    Reálne hodnoty sa doplnia z jednotlivých service_*_for_analysis.
    """
    return {
        "schema_version": 1,
        "user": {
            "id": user_id,
            "sex": None,
            "age": None,
            "height_cm": None,
            "weight_kg": None,
            "training_age_years": None,
        },
        "prefs": {
            "goal_kind": None,
            "weeks": None,
            "plan_start_date": None,
            "main_sport": None,
            "secondary_mix": [],
            "strength_settings": None,
            "weekly_time_budget_min": None,
            "hard_days_per_week_max": None,
            "notes_for_coach": None,
        },
        "zones": {
            "run": {
                "hr_max": None,
                "lthr_bpm": None,
                "zones": [],
            }
        },
        "thresholds": {
            "run": {
                "lthr_bpm": None,
                "pace_lthr_s_per_km": None,
                "ftp_power_w": None,
                "vo2max_estimate": None,
            }
        },
        "bests": {
            "run": [],
            "ride": [],
        },
        "recent_load": {
            "schema_version": 1,
            "window_days": 42,
            "weeks": [],
        },
        "recovery": {
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        },
        "active_plan": {
            "has_active_plan": False,
            "current_week_index": None,
            "total_weeks": None,
            "horizon_days": None,
        },
        "external_events": None,
        "last_activities": [],
    }


def build_input_from_db(
    user_id: int,
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Poskladá CoachAnalyzeInput z DB.

    - ak service=False → všetko ide cez RLS (vyžaduje user_jwt),
    - ak service=True  → používa sa service klient (user_jwt sa len forwarduje).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    input_data = build_base_input(user_id)

    # 1) PROFIL
    input_data["user"] = service_load_user_profile_for_analysis(
        user_id=user_id,
        user_uid=None,
        user_jwt=jwt,
        service=service,
    )

    # 2) ZONES
    input_data["zones"] = service_build_zones_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 3) THRESHOLDS
    input_data["thresholds"] = service_build_thresholds_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 4) PREFS
    input_data["prefs"] = service_load_coach_prefs_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 5) BESTS
    input_data["bests"] = service_build_bests_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 6) RECENT LOAD
    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=42,
        user_jwt=jwt,
        service=service,
    )

    # 7) RECOVERY
    input_data["recovery"] = service_build_recovery_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 8) ACTIVE PLAN
    input_data["active_plan"] = service_build_active_plan_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # 9) EXTERNAL EVENTS
    input_data["external_events"] = service_build_external_events_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # 10) LAST ACTIVITIES
    input_data["last_activities"] = build_last_activities_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
        limit=6,
    )

    return input_data