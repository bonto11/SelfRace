# Services/coach_athlete_state.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Services.profile_metrics import service_load_user_profile_for_analysis
from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_bests import service_build_bests_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.activities_summary_recent_load import (
    service_build_recent_load_block_for_analysis,
)
from Routes_AI.analyze_athlete_state import generate_athlete_state_json


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_base_input(user_id: int) -> Dict[str, Any]:
    """
    Základný tvar CoachAnalyzeInput – všetko prázdne.
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
        "zones": {"run": {"hr_max": None, "lthr_bpm": None, "zones": []}},
        "thresholds": {
            "run": {
                "lthr_bpm": None,
                "pace_lthr_s_per_km": None,
                "ftp_power_w": None,
                "vo2max_estimate": None,
            }
        },
        "bests": {"run": [], "ride": []},
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
    }


def build_input_from_db(user_id: int) -> Dict[str, Any]:
    """
    CoachAnalyzeInput – čistá DB cesta.
    """
    input_data = _build_base_input(user_id)

    # 1) PROFIL
    input_data["user"] = service_load_user_profile_for_analysis(
        user_id=user_id, user_uid=None
    )

    # 2) ZÓNY
    input_data["zones"] = service_build_zones_block_for_analysis(user_id)

    # 3) PRAHY
    input_data["thresholds"] = service_build_thresholds_block_for_analysis(user_id)

    # 4) PREFS
    input_data["prefs"] = service_load_coach_prefs_for_analysis(user_id)

    # 5) PB
    input_data["bests"] = service_build_bests_block_for_analysis(user_id)

    # 6) RECENT LOAD
    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=42,
    )

    # 7) RECOVERY
    input_data["recovery"] = service_build_recovery_block_for_analysis(user_id)

    return input_data


def save_state_to_db(user_id: int, state: Dict[str, Any]) -> Optional[int]:
    """
    Stub ukladania – zatiaľ len vráti 1.
    Keď budeš mať coach_athlete_state tabuľku, nahradíš to INSERT/UPSERT-om.
    """
    # TODO: reálny INSERT/UPSERT
    return 1


def service_analyze_athlete(
    user_id: int,
    model: str = "gpt-4o-mini",
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia, ktorú volá FE / interné volanie.

    - poskladá CoachAnalyzeInput z DB
    - zavolá OpenAI cez generate_athlete_state_json
    - uloží state do DB (stub)
    - vráti {state_id, state, input, model, debug?}
    """
    # 1) INPUT
    input_data = build_input_from_db(user_id)

    # 2) AI CALL
    state, trace = generate_athlete_state_json(
        context_payload=input_data,
        model=model,
        debug_raw=debug,
    )

    # 3) STORAGE
    state_id: Optional[int] = None
    if save_to_db:
        state_id = save_state_to_db(user_id, state)

    # 4) RESPONSE
    resp: Dict[str, Any] = {
        "state_id": state_id,
        "state": state,
        "input": input_data,
        "model": model,
    }
    if debug and trace is not None:
        resp["debug_ai"] = trace

    return resp