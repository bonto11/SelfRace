# Services/coach_athlete_state.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Services.profile_metrics import service_load_user_profile_for_analysis
from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_bests import service_build_bests_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.activities_summary_recent_load import (
    service_build_recent_load_block_for_analysis,
)

# -------------------- LOW-LEVEL HELPERS --------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_base_input(user_id: int) -> Dict[str, Any]:
    """
    Základný tvar CoachAnalyzeInput – všetko prázdne.
    Postupne to budeme dopĺňať z DB (profile, prefs, zones, thresholds, bests, recent_load).
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
            # kľúče po športoch – zatiaľ len "run"
            "run": {
                "hr_max": None,
                "lthr_bpm": None,
                "zones": [],  # [{name, hr_min, hr_max}]
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
            # TODO: doplniť z HRV/RHR/sleep metrík, zatiaľ prázdne
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        },
        "active_plan": {
            # TODO: ak neskôr zavedieš tabuľku pre aktívny plán, sem sa to mapne
            "has_active_plan": False,
            "current_week_index": None,
            "total_weeks": None,
            "horizon_days": None,
        },
    }


# -------------------- INPUT BUILDER: DB CESTA --------------------


def build_input_from_db(user_id: int) -> Dict[str, Any]:
    """
    Hlavný builder CoachAnalyzeInput – čistá DB cesta.

    - načíta user profil
    - prefs
    - zones (cez novú services.user_zones)
    - thresholds (cez services.user_thresholds)
    - bests
    - recent_load
    """
    input_data = _build_base_input(user_id)

    # 1) PROFIL
    input_data["user"] = service_load_user_profile_for_analysis(
        user_id=user_id, user_uid=None
    )

    # 2) ZONES
    input_data["zones"] = service_build_zones_block_for_analysis(user_id)

    # 3) THRESHOLDS

    input_data["thresholds"] = service_build_thresholds_block_for_analysis(user_id)

    # 4) PREFS
    input_data["prefs"] = service_load_coach_prefs_for_analysis(user_id)

    # 5) BESTS
    input_data["bests"] = service_build_bests_block_for_analysis(user_id)

    # 6) RECENT LOAD
    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id, window_days=42
    )

    # 7) RECOVERY
    input_data["recovery"] = service_build_recovery_block_for_analysis(user_id)

    return input_data


# -------------------- STATE BUILDER (STUB) --------------------


def build_state_from_input(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stub generovanie CoachAthleteState z inputu.
    Zatiaľ len jednoduché heuristiky – hlavne z PB na 5k.
    """
    prefs = input_data.get("prefs") or {}
    bests = (input_data.get("bests") or {}).get("run") or []

    main_sport = prefs.get("main_sport") or "run"
    weeks = prefs.get("weeks") or 4
    goal = prefs.get("goal_kind") or "improve_overall"

    # jednoduché skóre podľa PB na 5k
    fitness_level_run = 5
    for b in bests:
        dist = b.get("distance_m")
        t = b.get("best_time_s")
        if not dist or not t:
            continue
        if dist == 5000:
            pace = t / 5000.0
            if pace < 0.24:  # ~4:00/km
                fitness_level_run = max(fitness_level_run, 8)
            elif pace < 0.26:  # ~4:20/km
                fitness_level_run = max(fitness_level_run, 7)
            elif pace < 0.28:  # ~4:40/km
                fitness_level_run = max(fitness_level_run, 6)

    block_kind = "base_aerobic"
    if goal in ("race_time", "improve_speed"):
        block_kind = "threshold_speed"
    elif goal == "improve_endurance":
        block_kind = "base_long"

    return {
        "schema_version": 1,
        "generated_at": _now_iso(),
        "model": "coach-analyze-stub",
        "user_summary": {
            "headline": "Formálne: stabilná forma, priestor na väčší Z2 objem.",
            "bullets": [
                f"Cieľ: {goal}, horizont ~{weeks} týždňov.",
                f"Hlavný šport: {main_sport}.",
                "PB dáta sú zatiaľ len orientačne zohľadnené (stub heuristika).",
            ],
            "risks": [
                "Riziko rýchleho zvyšovania objemu, ak to preženieš.",
            ],
            "suggestions_short": [
                "Udrž stabilný počet tréningových dní.",
                "Buduj konzistentný Z2 objem.",
                "1–2 kvalitné intenzívne tréningy týždenne zvyčajne stačia.",
            ],
        },
        "ai_state": {
            "fitness_level": {
                "run": {
                    "level_1_to_10": fitness_level_run,
                    "comment": "slušný základ, ale stále je čo ladiť",
                },
                "ride": {
                    "level_1_to_10": 5,
                    "comment": "udržiavacia úroveň (stub)",
                },
                "strength": {
                    "level_1_to_10": 5,
                    "comment": "primeraná sila celého tela (stub)",
                },
            },
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {
                "weekly_minutes_min": 180,
                "weekly_minutes_max": 300,
                "note": "zvyšovať objem max ~10–15 % medzi týždňami",
            },
            "intensity_tolerance": {
                "hard_sessions_per_week_max": (
                    input_data.get("prefs", {}).get("hard_days_per_week_max") or 3
                ),
                "comment": "2 hlavné kvalitné tréningy + 1 doplnkový je strop (stub).",
            },
            "suggested_block_kind": block_kind,
            "key_limitations": [
                "inconsistent_long_runs",
            ],
            "key_strengths": [
                "good_general_fitness",
            ],
            "metrics": {
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
        },
    }


# -------------------- STORAGE STUB --------------------


def save_state_to_db(user_id: int, state: Dict[str, Any]) -> Optional[int]:
    """
    Stub ukladania – ak už máš implementáciu s DB (coach_athlete_state tabuľka),
    môžeš ju sem nahradiť. Teraz len vrátime 1, aby FE videl state_id.
    """
    # TODO: nahradiť reálnym INSERT/UPSERT do DB
    return 1


# -------------------- PUBLIC SERVICE --------------------


def service_analyze_athlete(
    user_id: int,
    model: str = "coach-analyze-stub",
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia, ktorú volá router.

    Vždy ide čistá DB cesta – FE neposiela žiadny payload.
    """
    input_data = build_input_from_db(user_id)

    state = build_state_from_input(input_data)

    state_id: Optional[int] = None
    if save_to_db:
        state_id = save_state_to_db(user_id, state)

    if debug:
        print("[coach_athlete_state] debug input:", input_data)  # noqa: T201
        print("[coach_athlete_state] debug state:", state)  # noqa: T201

    return {
        "state_id": state_id,
        "state": state,
        "input": input_data,
        "model": model,
    }
