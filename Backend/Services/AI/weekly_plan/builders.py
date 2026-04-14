from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import date

from Configs.config import (
    COACH_PLAN_MIN_WEEKS,
    COACH_PLAN_DEFAULT_WEEKS,
    COACH_PLAN_MAX_WEEKS,
)

from Services.AI.athlete_state.builders import build_input_from_db
from DB.coach_athlete_state import (
    db_get_state_by_id,
    db_get_latest_state_for_user,
)
from Services.coach_external_events import (
    service_build_external_events_block_for_analysis,
)
from Modules.Supabase.auth import AuthCtx


def load_athlete_state_for_plan(
    user_id: int,
    state_id: Optional[int],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    row: Optional[Dict[str, Any]] = None

    if state_id is not None:
        row = db_get_state_by_id(state_id, ctx=ctx)

    if not row:
        row = db_get_latest_state_for_user(user_id=user_id, version=1, ctx=ctx)

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
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        return raw_prefs["value"]
    if isinstance(raw_prefs, dict):
        return raw_prefs
    return {}


def _minify_analyze_input_for_weekly(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    ai: Dict[str, Any] = dict(analyze_input) if isinstance(analyze_input, dict) else {}

    u = ai.get("user")
    if isinstance(u, dict):
        u2 = dict(u)
        u2.pop("id", None)
        u2.pop("email", None)
        u2.pop("name", None)
        ai["user"] = u2

    la = ai.get("last_activities")
    if isinstance(la, list):
        trimmed: List[Dict[str, Any]] = []
        for a in la:
            if not isinstance(a, dict):
                continue
            dur_min = (
                a.get("duration_min")
                or a.get("moving_time_min")
                or a.get("moving_time")
            )
            trimmed.append(
                {
                    "sport": a.get("sport") or a.get("type"),
                    "distance_km": a.get("distance_km") or a.get("distance"),
                    "duration_min": dur_min,
                    "avg_hr": a.get("avg_hr"),
                    "load": a.get("load") or a.get("trimp"),
                    "day_offset": a.get("day_offset"),
                    "date": a.get("date"),
                    "z1_min": a.get("z1_min"),
                    "z2_min": a.get("z2_min"),
                    "z3_min": a.get("z3_min"),
                    "z4_min": a.get("z4_min"),
                    "z5_min": a.get("z5_min"),
                }
            )
            if len(trimmed) >= 20:
                break
        ai["last_activities"] = trimmed

    # ✂️ EXTRÉMNA ÚSPORA: Zmažeme redundantné bloky, ktoré posielame vyššie v JSON štruktúre!
    ai.pop("prefs", None)
    ai.pop("thresholds", None)
    ai.pop("zones", None)
    ai.pop("bests", None)

    ai.pop("streams", None)
    ai.pop("laps", None)
    ai.pop("splits", None)

    return ai


def _check_is_returning_beginner(analyze_input: Dict[str, Any]) -> bool:
    last_activities = analyze_input.get("last_activities") or []
    if not last_activities:
        return True

    latest_date_str = None
    for act in last_activities:
        d = act.get("start_date_local") or act.get("start_date") or act.get("date")
        if d:
            if latest_date_str is None or d > latest_date_str:
                latest_date_str = d

    if not latest_date_str:
        return True

    try:
        latest_dt = date.fromisoformat(latest_date_str[:10])
        diff = (date.today() - latest_dt).days
        if diff > 42:
            return True
    except Exception:
        pass

    return False


def build_weekly_context_from_db(
    user_id: int,
    *,
    ctx: AuthCtx,
    state_id: Optional[int],
    weeks: Optional[int],
) -> Dict[str, Any]:
    analyze_input = build_input_from_db(user_id=user_id, ctx=ctx)
    if not isinstance(analyze_input, dict):
        analyze_input = {}

    prefs_ai = _extract_prefs_ai(analyze_input)

    external_events_block = analyze_input.get("external_events")
    if external_events_block is None:
        try:
            external_events_block = service_build_external_events_block_for_analysis(
                user_id=user_id, ctx=ctx
            )
        except Exception:
            external_events_block = None

    state_bundle = load_athlete_state_for_plan(
        user_id=user_id, state_id=state_id, ctx=ctx
    )

    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    is_returning_beginner = _check_is_returning_beginner(analyze_input)
    if isinstance(athlete_state, dict):
        athlete_state["is_returning_beginner"] = is_returning_beginner

    raw_weeks = int(weeks or prefs_ai.get("weeks") or COACH_PLAN_DEFAULT_WEEKS)
    horizon_weeks = max(COACH_PLAN_MIN_WEEKS, min(raw_weeks, COACH_PLAN_MAX_WEEKS))

    analyze_input_min = _minify_analyze_input_for_weekly(analyze_input)

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "weeks": horizon_weeks,
        "overwrite": True,
        "prefs": prefs_ai,
        "analyze_input_min": analyze_input_min,
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
        "analyze_input_min": analyze_input_min,
    }


def build_weekly_rows_from_ai(
    user_id: int,
    weeks_list: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for idx, w in enumerate(weeks_list, start=1):
        if not isinstance(w, dict):
            continue

        week_index = int(w.get("week_index") or idx)

        rows.append(
            {
                "user_id": user_id,
                "week_index": week_index,
                "week_start": w.get("week_start"),
                "week_end": w.get("week_end"),
                "goal": w.get("goal"),
                "focus": w.get("focus"),
                "load_phase": w.get("load_phase"),
                "planned_stats": w.get("planned_stats") or {},
                "actual_stats": {},
                "notes": w.get("notes"),
                "raw_json": w,
            }
        )

    return rows
