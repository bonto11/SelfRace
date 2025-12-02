# Services/coach_state_analyze.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from Modules.SQL.db_handler import get_client

from Schemas.coach_types import (
    CoachAnalyzeInput,
    CoachAthleteState,
)

supabase = get_client()


# ───────────────────────────── public API ─────────────────────────────


def service_analyze_athlete(
    user_id: int,
    *,
    model: str = "coach-analyze-stub",
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    High-level služba: načíta dáta o atlétovi, pošle ich do AI,
    vráti 'athlete_state' JSON a (voliteľne) ho uloží do DB.

    Return:
      {
        "state_id": int | None,
        "state": CoachAthleteState,
        "input": CoachAnalyzeInput,
        "model": str,
      }
    """
    analyze_input: CoachAnalyzeInput = build_analyze_input_from_db(user_id=user_id)

    if debug:
        print("[COACH-ANALYZE] input:", analyze_input)

    state_json: CoachAthleteState = call_llm_analyze_athlete(
        analyze_input,
        model=model,
        debug=debug,
    )

    state_id: Optional[int] = None
    if save_to_db:
        state_id = save_athlete_state(
            user_id=user_id,
            state_json=state_json,
            model=model,
        )

    return {
        "state_id": state_id,
        "state": state_json,
        "input": analyze_input,
        "model": model,
    }


# ───────────────────────────── build input (stub) ─────────────────────────────


def build_analyze_input_from_db(user_id: int) -> CoachAnalyzeInput:
    """
    Poskladá CoachAnalyzeInput.

    Zatiaľ STUB – nedotýka sa DB, aby to bolo bezpečné na spúšťanie.
    Neskôr doplníme reálne query na users/prefs/zóny/aktivity.
    """
    today = datetime.utcnow().date()

    inp: CoachAnalyzeInput = {
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
            "goal_kind": "improve_overall",
            "weeks": 6,
            "plan_start_date": today.isoformat(),
            "main_sport": "run",
            "secondary_mix": [],
            "strength_settings": {
                "equipment_mode": "minimal",
                "location": "home",
                "target_per_week": 2,
            },
            "weekly_time_budget_min": None,
            "hard_days_per_week_max": 3,
            "notes_for_coach": None,
        },
        "zones": {
            "run": {
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
    return inp


# ───────────────────────────── LLM stub ─────────────────────────────


def call_llm_analyze_athlete(
    payload: CoachAnalyzeInput,
    *,
    model: str = "coach-analyze-stub",
    debug: bool = False,
) -> CoachAthleteState:
    """
    Tu bude reálny call na LLM (OpenAI / Anthropic / tvoje API).

    Zatiaľ vracia rozumný STUB podľa špecifikácie CoachAthleteState,
    aby sa dalo testovať UI a flow bez AI.
    """
    now_iso = datetime.utcnow().isoformat() + "Z"

    state: CoachAthleteState = {
        "schema_version": 1,
        "generated_at": now_iso,
        "model": model,
        "user_summary": {
            "headline": "Formálne: stabilná forma, priestor na väčší Z2 objem.",
            "bullets": [
                "Posledné týždne máš skôr mierny tréningový objem.",
                "Nevidno extrémne výkyvy v intenzite ani objeme (stub).",
                "Na prácu s prahom potrebujeme pravidelnejší týždenný cyklus.",
            ],
            "risks": [
                "Riziko rýchleho zvyšovania objemu, ak to preženieš.",
            ],
            "suggestions_short": [
                "Udrž stabilný počet tréningových dní.",
                "Začni budovať konzistentný Z2 objem.",
                "1–2 kvalitné intenzívne tréningy týždenne stačia.",
            ],
        },
        "ai_state": {
            "fitness_level": {
                "run": {"level_1_to_10": 6, "comment": "slušný základ, ale nie peak"},
                "ride": {"level_1_to_10": 5, "comment": "udržiavacia úroveň"},
                "strength": {"level_1_to_10": 5, "comment": "primeraná sila celého tela"},
            },
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {
                "weekly_minutes_min": 180,
                "weekly_minutes_max": 300,
                "note": "zvyšovať objem max ~10–15 % medzi týždňami",
            },
            "intensity_tolerance": {
                "hard_sessions_per_week_max": 3,
                "comment": "2 hlavné kvalitné tréningy + 1 doplnkový je strop",
            },
            "suggested_block_kind": "base_aerobic",
            "key_limitations": ["inconsistent_long_runs"],
            "key_strengths": ["good_general_fitness"],
            "metrics": {
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
        },
    }

    if debug:
        print("[COACH-ANALYZE] stub state:", state)

    return state


# ───────────────────────────── DB persistence ─────────────────────────────


def save_athlete_state(
    user_id: int,
    state_json: CoachAthleteState,
    *,
    model: Optional[str] = None,
) -> Optional[int]:
    """
    Uloží athlete_state do tabuľky coach_athlete_state, ak existuje.

    Ak tabuľka ešte nemáš vytvorenú, funkcia v tichosti vráti None,
    aby ti to nelámalo backend.
    """
    try:
        res = (
            supabase.table("coach_athlete_state")
            .insert(
                {
                    "user_id": user_id,
                    "model": model or state_json.get("model"),
                    "version": int(state_json.get("schema_version", 1)),
                    "state_json": state_json,
                }
            )
            .execute()
        )
        rows = res.data or []
        return rows[0]["id"] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[COACH-ANALYZE] save_athlete_state error:", repr(e))
        return None