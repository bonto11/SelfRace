# Services/AI/weekly_plan_builders.py
from __future__ import annotations

import os
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


def _debug_enabled() -> bool:
    return (os.getenv("COACH_DEBUG", "") or "").lower() in ("1", "true", "yes", "on")


def _include_full_analyze_input() -> bool:
    # explicit opt-in; debug tiež povoľ
    return _debug_enabled() or (os.getenv("COACH_INCLUDE_ANALYZE_INPUT", "") or "").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _dbg(*args: Any) -> None:
    if _debug_enabled():
        print(*args)


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
      - {"plan":  [ ... ]}
      - [ { ... }, { ... } ]
    """
    if isinstance(weekly_plan, dict):
        weeks = weekly_plan.get("weeks")
        if isinstance(weeks, list):
            return [w for w in weeks if isinstance(w, dict)]
        plan = weekly_plan.get("plan")
        if isinstance(plan, list):
            return [w for w in plan if isinstance(w, dict)]
        return []
    if isinstance(weekly_plan, list):
        return [w for w in weekly_plan if isinstance(w, dict)]
    return []


def _extract_prefs_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    raw_prefs = analyze_input.get("prefs") or {}
    if (
        isinstance(raw_prefs, dict)
        and "value" in raw_prefs
        and isinstance(raw_prefs["value"], dict)
    ):
        return raw_prefs["value"]
    if isinstance(raw_prefs, dict):
        return raw_prefs
    return {}


def _minify_analyze_input_for_weekly(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    Jemná minifikácia už na úrovni buildera (SAFE):
    - odstráni citlivé/ťažké veci
    - necháva štruktúru podobnú analyze_input
    """
    ai: Dict[str, Any] = dict(analyze_input) if isinstance(analyze_input, dict) else {}

    # user: drop id + meno/email ak by sa niekedy objavili
    u = ai.get("user")
    if isinstance(u, dict):
        u2 = dict(u)
        u2.pop("id", None)
        u2.pop("email", None)
        u2.pop("name", None)
        ai["user"] = u2

    # last_activities: často obsahujú názvy a timestampy -> nechaj len agregácie
    la = ai.get("last_activities")
    if isinstance(la, list):
        trimmed: List[Dict[str, Any]] = []
        for a in la:
            if not isinstance(a, dict):
                continue
            trimmed.append(
                {
                    "sport": a.get("sport") or a.get("type"),
                    "distance_km": a.get("distance_km") or a.get("distance"),
                    "moving_time_min": a.get("moving_time_min") or a.get("moving_time"),
                    "load": a.get("load") or a.get("trimp"),
                    "day_offset": a.get("day_offset"),
                }
            )
            if len(trimmed) >= 20:
                break
        ai["last_activities"] = trimmed

    # drop raw streams/laps/splits ak by sa objavili
    ai.pop("streams", None)
    ai.pop("laps", None)
    ai.pop("splits", None)

    return ai


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
    Poskladá context_payload pre weekly plán z DB + meta info.
    """
    analyze_input = build_input_from_db(
        user_id=user_id,
        user_jwt=user_jwt,
        service=service,
    )
    if not isinstance(analyze_input, dict):
        analyze_input = {}

    prefs_ai = _extract_prefs_ai(analyze_input)

    # external events: prefer priamo z analyze_input, inak dopočítaj
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

    state_bundle = load_athlete_state_for_plan(
        user_id=user_id,
        state_id=state_id,
        user_jwt=user_jwt,
        service=service,
    )

    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    raw_weeks = int(weeks or prefs_ai.get("weeks") or COACH_PLAN_DEAFULT_WEEKS)

    _dbg("[DB-COACH-WEEKLY] weeks(payload):", weeks)
    _dbg("[DB-COACH-WEEKLY] prefs_ai.weeks:", prefs_ai.get("weeks"))
    _dbg("[DB-COACH-WEEKLY] raw_weeks:", raw_weeks)

    horizon_weeks = max(
        COACH_PLAN_MIN_WEEKS,
        min(raw_weeks, COACH_PLAN_MAX_WEEKS),
    )

    analyze_input_min = _minify_analyze_input_for_weekly(analyze_input)

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        # držíš user_id kvôli server-side logike (settings, billing, meta)
        "user_id": user_id,
        "weeks": horizon_weeks,
        "overwrite": overwrite,
        "prefs": prefs_ai,
        # ✅ default: only minified
        "analyze_input_min": analyze_input_min,
        "athlete_state": athlete_state,
        "athlete_state_meta": {
            "state_id": used_state_id,
            "model": state_bundle.get("model"),
            "version": state_bundle.get("version"),
            "created_at": state_bundle.get("created_at"),
        },
    }

    # opt-in: full analyze_input iba keď chceš
    if _include_full_analyze_input():
        context_payload["analyze_input"] = analyze_input

    if external_events_block is not None:
        context_payload["external_events"] = external_events_block

    return {
        "context_payload": context_payload,
        "state_bundle": state_bundle,
        "prefs_ai": prefs_ai,
        "horizon_weeks": horizon_weeks,
        # vraciaš aj pre debug/logiku
        "analyze_input": analyze_input,
        "analyze_input_min": analyze_input_min,
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

        rows.append(
            {
                "user_id": user_id,
                "plan_id": plan_id,
                "week_index": week_index,
                "week_start": w.get("week_start"),
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
        )

    return rows