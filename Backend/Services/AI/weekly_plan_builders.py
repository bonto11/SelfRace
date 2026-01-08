# backend/Services/AI/weekly_plan_builders.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Configs.config import (
    COACH_PLAN_MIN_WEEKS,
    COACH_PLAN_DEAFULT_WEEKS,
    COACH_PLAN_MAX_WEEKS,
)

from Services.AI.athlete_state_input_builder import build_input_from_db
from Routes_DB.coach_athlete_state import (
    db_get_state_by_id,
    db_get_latest_state_for_user,
)
from Services.coach_external_events import (
    service_build_external_events_block_for_analysis,
)


def load_athlete_state_for_plan(
    user_id: int,
    state_id: Optional[int],
    *,
    user_jwt: Optional[str],
    service: bool = False,
) -> Dict[str, Any]:
    """
    Nájde vhodný coach_athlete_state pre plánovanie.

    Priority:
      1) explicitný state_id (ak existuje),
      2) najnovší stav pre usera (version=1).
    """
    jwt = user_jwt

    row: Optional[Dict[str, Any]] = None

    if state_id is not None:
        row = db_get_state_by_id(
            state_id,
            user_jwt=jwt,
            service=service,
        )

    if not row:
        row = db_get_latest_state_for_user(
            user_id=user_id,
            version=1,
            user_jwt=jwt,
            service=service,
        )

    if not row:
        raise ValueError(
            "No athlete state found for this user. "
            "Run /coach/athlete/analyze first or pass a valid state_id."
        )

    state_json = row.get("state_json")
    if not isinstance(state_json, dict):
        raise ValueError("Stored athlete state has invalid format (state_json).")

    return {
        "state_id": row.get("id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
    }


def extract_weeks_payload(weekly_plan: Any) -> List[Dict[str, Any]]:
    """
    Z AI výstupu vytiahne list týždňov.
    Podporujeme:
      - {"weeks": [ ... ]}
      - [ { ... }, { ... } ]
    """
    if isinstance(weekly_plan, dict):
        weeks = weekly_plan.get("weeks")
        if isinstance(weeks, list):
            return weeks
        if isinstance(weekly_plan.get("plan"), list):
            return weekly_plan["plan"]
        return []
    if isinstance(weekly_plan, list):
        return weekly_plan
    return []


def build_weekly_context_from_db(
    user_id: int,
    *,
    user_jwt: Optional[str],
    service: bool,
    overwrite: bool,
    state_id: Optional[int],
    weeks: Optional[int],
) -> Dict[str, Any]:
    """
    Poskladá context_payload pre weekly plán z DB + meta info,
    ktoré potrebuje service vrstva.
    """
    # 1) vstup pre AI (rovnaký ako pre analyze)
    analyze_input = build_input_from_db(
        user_id=user_id,
        user_jwt=user_jwt,
        service=service,
    )

    # PREFS – flatten
    raw_prefs = analyze_input.get("prefs") or {}
    if (
        isinstance(raw_prefs, dict)
        and "value" in raw_prefs
        and isinstance(raw_prefs["value"], dict)
    ):
        prefs_ai = raw_prefs["value"]
    elif isinstance(raw_prefs, dict):
        prefs_ai = raw_prefs
    else:
        prefs_ai = {}

    # EXTERNAL EVENTS – už by mali byť v analyze_input, ale pre istotu:
    external_events_block = analyze_input.get("external_events")
    if external_events_block is None:
        try:
            external_events_block = service_build_external_events_block_for_analysis(
                user_id=user_id,
                user_jwt=user_jwt,
                service=service,
            )
        except Exception:
            external_events_block = None

    # 2) stav atlétu z analyze
    state_bundle = load_athlete_state_for_plan(
        user_id=user_id,
        state_id=state_id,
        user_jwt=user_jwt,
        service=service,
    )

    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    # koľko týždňov – preferuj z payloadu, inak z prefs, fallback default
    raw_weeks = int(weeks or prefs_ai.get("weeks") or COACH_PLAN_DEAFULT_WEEKS)
    print("[DB-COACH-WEEKLY] weeks (payload):", weeks)
    print("[DB-COACH-WEEKLY] prefs_ai.get('weeks'):", prefs_ai.get("weeks"))
    print("[DB-COACH-WEEKLY] raw_weeks:", raw_weeks)
    horizon_weeks = max(
        COACH_PLAN_MIN_WEEKS,
        min(raw_weeks, COACH_PLAN_MAX_WEEKS),
    )

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "weeks": horizon_weeks,
        "overwrite": overwrite,
        "prefs": prefs_ai,
        "analyze_input": analyze_input,
        "athlete_state": athlete_state,
        "athlete_state_meta": {
            "state_id": used_state_id,
            "model": state_bundle.get("model"),
            "version": state_bundle.get("version"),
            "created_at": state_bundle.get("created_at"),
        },
    }

    if external_events_block is not None:
        context_payload["external_events"] = external_events_block

    return {
        "context_payload": context_payload,
        "state_bundle": state_bundle,
        "prefs_ai": prefs_ai,
        "horizon_weeks": horizon_weeks,
        "analyze_input": analyze_input,
    }


def build_weekly_rows_from_ai(
    user_id: int,
    plan_id: str,
    weeks_list: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Preklopí weekly AI výstup na rows pre coach_plan_weekly.
    """
    rows: List[Dict[str, Any]] = []

    for idx, w in enumerate(weeks_list, start=1):
        if not isinstance(w, dict):
            continue

        week_index = int(w.get("week_index") or idx)

        row: Dict[str, Any] = {
            "user_id": user_id,
            "plan_id": plan_id,
            "week_index": week_index,
            "week_start": w.get("week_start"),  # "YYYY-MM-DD"
            "week_end": w.get("week_end"),
            "goal": w.get("goal"),
            "focus": w.get("focus"),
            "load_phase": w.get("load_phase"),
            "planned_km": w.get("planned_km"),
            "planned_minutes": w.get("planned_minutes"),
            "completed_km": None,
            "completed_minutes": None,
            "notes": w.get("notes"),
            "raw_json": w,
        }

        rows.append(row)

    return rows
