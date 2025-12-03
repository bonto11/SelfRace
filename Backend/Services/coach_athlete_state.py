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
from Routes_AI.analyze_athlete_state import call_ai_analyze_athlete_state


# -------------------- HELPERS --------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_state_to_db(user_id: int, state: Dict[str, Any]) -> Optional[int]:
    """
    Stub ukladania – ak už máš implementáciu s DB (coach_athlete_state tabuľka),
    môžeš ju sem nahradiť. Teraz len vrátime 1, aby FE videl state_id.
    """
    # TODO: nahradiť reálnym INSERT/UPSERT do DB
    return 1


# -------------------- INPUT BUILDER (JEDINÁ SKLADAČKA) --------------------


def build_input_from_db(user_id: int) -> Dict[str, Any]:
    """
    Hlavný builder CoachAnalyzeInput – čistá DB cesta.

    - načíta user profil
    - prefs
    - zones
    - thresholds
    - bests
    - recent_load
    - recovery
    """
    input_data: Dict[str, Any] = {
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
    }

    # 1) PROFIL
    user_block = service_load_user_profile_for_analysis(
        user_id=user_id,
        user_uid=None,
    )
    if user_block:
        input_data["user"].update(user_block)

    # 2) PREFS (coach.prefs JSON)
    prefs_block = service_load_coach_prefs_for_analysis(user_id)
    if prefs_block:
        input_data["prefs"] = prefs_block

    # 3) ZONES
    zones_block = service_build_zones_block_for_analysis(user_id)
    if zones_block:
        input_data["zones"] = zones_block

    # 4) THRESHOLDS
    thresholds_block = service_build_thresholds_block_for_analysis(user_id)
    if thresholds_block:
        input_data["thresholds"] = thresholds_block

    # 5) BESTS
    bests_block = service_build_bests_block_for_analysis(user_id)
    if bests_block:
        input_data["bests"] = bests_block

    # 6) RECENT LOAD
    recent_block = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=42,
    )
    if recent_block:
        input_data["recent_load"] = recent_block

    # 7) RECOVERY
    recovery_block = service_build_recovery_block_for_analysis(user_id)
    if recovery_block:
        input_data["recovery"] = recovery_block

    return input_data


# -------------------- PUBLIC SERVICE (VOLÁ RÚTU / AI) --------------------

def service_analyze_athlete(
    user_id: int,
    model: str = "gpt-4.1-mini",  # alebo čo chceš
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    input_data = build_input_from_db(user_id)

    state = call_ai_analyze_athlete_state(
        input_data,
        model=model,
        debug_raw=debug,
    )

    state_id: Optional[int] = None
    if save_to_db:
        state_id = save_state_to_db(user_id, state)

    if debug:
        print("[coach_athlete_state] input:", input_data)
        print("[coach_athlete_state] state:", state)

    return {
        "state_id": state_id,
        "state": state,
        "input": input_data,
        "model": model,
    }