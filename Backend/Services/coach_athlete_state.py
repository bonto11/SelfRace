from __future__ import annotations
import json
from datetime import datetime, timezone, timedelta, date
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
from Services.coach_external_events import service_list_external_events_window
from Services.coach_plan_meta import service_build_active_plan_block_for_analysis
from Routes_AI.analyze_athlete_state import generate_athlete_state_json

from Routes_DB.coach_athlete_state import (
    db_insert_athlete_state,
    db_get_state_by_id,
    db_get_latest_state_for_user,
    db_list_states_for_user,
)

from Configs.config import DEFAULT_MODEL


# -------------------- HELPERS --------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_base_input(user_id: int) -> Dict[str, Any]:
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
        # external_events doplníme neskôr
    }


def service_build_external_events_block_for_analysis(
    user_id: int,
    *,
    days_past: int = 28,
    days_future: int = 42,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vráti blok external_events pre analyze/weekly/daily:

    {
      "schema_version": 1,
      "window": {
        "from": "YYYY-MM-DD",
        "to": "YYYY-MM-DD",
        "events": [ ... occurrences ... ]
      }
    }

    Okno: posledných N dní dozadu + M dní dopredu od dnes.
    """
    today = date.today()
    d_from = today - timedelta(days=days_past)
    d_to = today + timedelta(days=days_future)

    try:
        # Podporíme obidve verzie service_list_external_events_window
        if user_jwt is not None:
            window = service_list_external_events_window(
                user_id=user_id,
                from_iso=d_from.isoformat(),
                to_iso=d_to.isoformat(),
                user_jwt=user_jwt,  # nová JWT RLS cesta
            )
        else:
            window = service_list_external_events_window(
                user_id=user_id,
                from_iso=d_from.isoformat(),
                to_iso=d_to.isoformat(),
            )

        events = window.get("events") or []
        return {
            "schema_version": 1,
            "window": {
                "from": d_from.isoformat(),
                "to": d_to.isoformat(),
                "events": events,
            },
        }
    except Exception as exc:  # noqa: BLE001
        # nech to nespadne analyze/weekly/daily – len prázdny blok + error text
        return {
            "schema_version": 1,
            "window": {
                "from": d_from.isoformat(),
                "to": d_to.isoformat(),
                "events": [],
            },
            "error": f"external_events_load_failed: {exc}",
        }


# -------------------- INPUT BUILDER: DB → CoachAnalyzeInput --------------------


def build_input_from_db(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Poskladá CoachAnalyzeInput z DB.

    - ak príde user_jwt → všetky user-data služby idú cez RLS/JWT
    - ak user_jwt=None → fallback na existujúce service-role volania
      (kvôli weekly/daily generátoru, ktorý zatiaľ JWT neposiela)
    """
    input_data = _build_base_input(user_id)

    # 1) PROFIL
    if user_jwt is not None:
        input_data["user"] = service_load_user_profile_for_analysis(
            user_id=user_id,
            user_uid=None,
            user_jwt=user_jwt,
        )
    else:
        input_data["user"] = service_load_user_profile_for_analysis(
            user_id=user_id,
            user_uid=None,
        )

    # 2) ZONES
    if user_jwt is not None:
        input_data["zones"] = service_build_zones_block_for_analysis(
            user_id,
            user_jwt=user_jwt,
        )
    else:
        input_data["zones"] = service_build_zones_block_for_analysis(user_id)

    # 3) THRESHOLDS
    if user_jwt is not None:
        input_data["thresholds"] = service_build_thresholds_block_for_analysis(
            user_id,
            user_jwt=user_jwt,
        )
    else:
        input_data["thresholds"] = service_build_thresholds_block_for_analysis(user_id)

    # 4) PREFS
    if user_jwt is not None:
        input_data["prefs"] = service_load_coach_prefs_for_analysis(
            user_id,
            user_jwt=user_jwt,
        )
    else:
        input_data["prefs"] = service_load_coach_prefs_for_analysis(user_id)

    # 5) BESTS
    if user_jwt is not None:
        input_data["bests"] = service_build_bests_block_for_analysis(
            user_id,
            user_jwt=user_jwt,
        )
    else:
        input_data["bests"] = service_build_bests_block_for_analysis(user_id)

    # 6) RECENT LOAD
    if user_jwt is not None:
        input_data["recent_load"] = service_build_recent_load_block_for_analysis(
            user_id=user_id,
            window_days=42,
            user_jwt=user_jwt,
        )
    else:
        input_data["recent_load"] = service_build_recent_load_block_for_analysis(
            user_id=user_id,
            window_days=42,
        )

    # 7) RECOVERY
    if user_jwt is not None:
        input_data["recovery"] = service_build_recovery_block_for_analysis(
            user_id,
            user_jwt=user_jwt,
        )
    else:
        input_data["recovery"] = service_build_recovery_block_for_analysis(user_id)

    # 8) ACTIVE PLAN
    if user_jwt is not None:
        input_data["active_plan"] = service_build_active_plan_block_for_analysis(
            user_id=user_id,
            user_jwt=user_jwt,
        )
    else:
        input_data["active_plan"] = service_build_active_plan_block_for_analysis(
            user_id=user_id
        )

    # 9) EXTERNAL EVENTS – nové (s podporou JWT)
    input_data["external_events"] = service_build_external_events_block_for_analysis(
        user_id=user_id,
        user_jwt=user_jwt,
    )

    return input_data


# -------------------- STORAGE --------------------


def service_save_state_to_db(user_id: int, analysis: Dict[str, Any]) -> Optional[int]:
    model = str(analysis.get("model") or "Trainalyze Coach")
    version = int(analysis.get("schema_version") or 1)
    return db_insert_athlete_state(
        user_id=user_id,
        model=model,
        state_json=analysis,
        version=version,
    )


def service_get_athlete_state_by_id(state_id: int) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny záznam z coach_athlete_state podľa id
    a rozbalí state_json do samostatného kľúča "state".
    """
    row = db_get_state_by_id(state_id)
    if not row:
        return None

    state_json = row.get("state_json") or {}

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
    }


def service_get_latest_athlete_state(
    user_id: int,
    version: Optional[int] = 1,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší stav pre usera (podľa created_at DESC).
    """
    row = db_get_latest_state_for_user(user_id=user_id, version=version)
    if not row:
        return None

    state_json = row.get("state_json") or {}

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
    }


def service_list_athlete_states_meta(
    user_id: int,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    História stavov – len meta info (bez state_json),
    vhodné na výpis v UI / debug.
    """
    rows = db_list_states_for_user(user_id=user_id, limit=limit)
    return [
        {
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "model": r.get("model"),
            "version": r.get("version"),
            "created_at": r.get("created_at"),
        }
        for r in rows or []
    ]


# -------------------- PUBLIC SERVICE: DB → AI → DB/FE --------------------


def service_analyze_athlete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    debug: bool = False,
    save_to_db: bool = True,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia pre AI analýzu atleta.

    - poskladá CoachAnalyzeInput z DB (s JWT → RLS)
    - zavolá OpenAI cez generate_athlete_state_json
    - (voliteľne) uloží analýzu do DB
    - vráti štruktúru vhodnú pre FE aj pre ďalší backend (plan-weekly)
    """

    # 1) INPUT (už cez JWT, ak prišiel)
    input_data = build_input_from_db(user_id, user_jwt=user_jwt)

    # 1b) Kontext pre AI – deep copy + drop external_activities z prefs
    context_for_ai = json.loads(json.dumps(input_data, default=str))
    try:
        prefs_block = context_for_ai.get("prefs") or {}
        if isinstance(prefs_block, dict):
            prefs_val = prefs_block.get("value")
            if isinstance(prefs_val, dict):
                prefs_val.pop("external_activities", None)
    except Exception:
        # nech analyze nespadne kvôli blbosti v prefse
        pass

    # 2) AI CALL – čistý výstup z AI = "analysis"
    model_to_use = model or DEFAULT_MODEL
    analysis, trace = generate_athlete_state_json(
        context_payload=input_data,  # ak chceš používať odfiltrovaný context_for_ai, vieme prehodiť
        model=model_to_use,
    )

    if not isinstance(analysis, dict):
        analysis = {}

    # doplníme meta, ak by ich AI neposlala
    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())
    analysis.setdefault("model", "Coach BeTY")

    # 3) STORAGE (voliteľné)
    state_id: Optional[int] = None
    if save_to_db:
        state_id = service_save_state_to_db(user_id, analysis)

    # 4) RESPONSE – jasné oddelenie INPUT vs AI OUTPUT
    resp: Dict[str, Any] = {
        "state_id": state_id,
        "model": model_to_use,
        "analysis": analysis,  # čistý výstup z AI (user_summary, ai_state, metrics…)
        "input": input_data,   # CoachAnalyzeInput snapshot
    }
    if debug:
        resp["debug_trace"] = trace

    return resp