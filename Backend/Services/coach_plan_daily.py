# Services/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Configs.config import DEFAULT_MODEL
from Services.coach_athlete_state import build_input_from_db
from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_weekly import db_get_week_row_for_plan
from Routes_DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_clear_daily_for_user_week,
)
from Routes_AI.generate_plan_daily import generate_daily_week_json


def _build_daily_rows_from_ai(
    user_id: int,
    plan_id: Optional[str],
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Preklopí AI výstup (daily_plan JSON) do rows pre coach_plan_daily.
    """
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []

    for day in days:
        date_str = day.get("date")
        sessions = day.get("sessions") or []
        if not date_str or not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict):
                continue

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str,
                "sport": s.get("sport") or "other",
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "zone_text": s.get("zone_text"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": "ai_daily_v1",
                "plan_id": plan_id,
                "session_type": s.get("session_type"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            }
            rows.append(row)

    return rows


def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str] = None,
    overwrite: bool = True,
    model: Optional[str] = None,
    debug: bool = True,
) -> Dict[str, Any]:
    """
    Generovanie DAILY plánu pre konkrétny týždeň.

    - načíta analyze_input (prefs, zones, thresholds, recent_load...)
    - načíta latest athlete_state
    - ak máme plan_id, vytiahne meta info týždňa z coach_plan_weekly
    - zavolá AI daily generátor
    - (ak overwrite) zmaže existujúce daily sessions v danom týždni
    - uloží nový daily plán do coach_plan_daily
    """
    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    # 1) analyze_input = to isté ako pri weekly/analyze
    analyze_input = build_input_from_db(user_id)
    prefs = analyze_input.get("prefs") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}
    recent_load = analyze_input.get("recent_load") or {}
    targets = analyze_input.get("targets") or {}

    # 2) athlete_state (z latest state)
    state_row = db_get_latest_state_for_user(user_id=user_id, version=1)
    athlete_state = (state_row or {}).get("state_json") or None

    # 3) weekly meta row (ak máme plan_id)
    week_row = None
    week_start = None
    week_end = None

    if plan_id is not None:
        week_row = db_get_week_row_for_plan(
            user_id=user_id,
            plan_id=plan_id,
            week_index=week_index,
        )
        if week_row:
            week_start = week_row.get("week_start")
            week_end = week_row.get("week_end")

    # 4) context pre AI
    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "week_index": week_index,
        "plan_id": plan_id,
        "overwrite": overwrite,
        "week": week_row or {
            "week_index": week_index,
            "week_start": week_start,
            "week_end": week_end,
        },
        "prefs": prefs,
        "targets": targets,
        "athlete_state": athlete_state,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
    }

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    daily_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )

    # 5) uloženie do DB
    week_start_ai = daily_plan.get("week_start") or week_start
    week_end_ai = daily_plan.get("week_end") or week_end

    deleted_rows = 0
    if overwrite and plan_id and week_start_ai and week_end_ai:
        deleted_rows = db_clear_daily_for_user_week(
            user_id=user_id,
            plan_id=plan_id,
            week_start=week_start_ai,
            week_end=week_end_ai,
        )

    rows = _build_daily_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id,
        daily_plan=daily_plan,
    )
    inserted_rows = db_insert_daily_rows(rows)

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "plan_id": plan_id,
        "week_index": week_index,
        "week_start": week_start_ai,
        "week_end": week_end_ai,
        "state_id": (state_row or {}).get("id"),
        "model": daily_model,
        "overwrite": overwrite,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
    }
    if debug:
        resp["debug"] = trace
        resp["context_payload"] = context_payload

    return resp