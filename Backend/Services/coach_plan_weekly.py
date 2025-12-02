# Services/coach_plan_weekly.py
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from Routes_DB.coach_plan_weekly import (
    db_insert_weekly_rows,
    db_clear_weekly_for_user_plan,
)

from Schemas.coach_types import (
    CoachWeeklyPlanInput,
    CoachWeeklyPlan,
    WeeklyWeek,
)


# ───────────────────────────── public API ─────────────────────────────


def service_generate_weekly_plan(
    user_id: int,
    *,
    athlete_state: Dict[str, Any],
    prefs: Dict[str, Any],
    plan_id: Optional[str] = None,
    model: str = "coach-weekly-stub",
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Vygeneruje weekly plán na N týždňov na základe athlete_state + prefs.
    """
    if plan_id is None:
        plan_id = str(uuid4())

    weekly_input: CoachWeeklyPlanInput = build_weekly_input(
        user_id=user_id,
        athlete_state=athlete_state,
        prefs=prefs,
        plan_id=plan_id,
    )

    weekly_plan: CoachWeeklyPlan = call_llm_generate_weekly(
        weekly_input,
        model=model,
        debug=debug,
    )

    inserted_weeks = 0
    if save_to_db:
        rows = weekly_plan_to_db_rows(
            user_id=user_id,
            plan_id=plan_id,
            weekly_plan=weekly_plan,
        )
        db_clear_weekly_for_user_plan(user_id=user_id, plan_id=plan_id)
        inserted_weeks = db_insert_weekly_rows(rows)

    return {
        "plan_id": plan_id,
        "weekly_plan": weekly_plan,
        "inserted_weeks": inserted_weeks,
    }


# ───────────────────────────── build input (stub) ─────────────────────────────


def build_weekly_input(
    user_id: int,
    *,
    athlete_state: Dict[str, Any],
    prefs: Dict[str, Any],
    plan_id: str,
) -> CoachWeeklyPlanInput:
    """
    Poskladá CoachWeeklyPlanInput.
    Čerpá z athlete_state.ai_state a prefs.
    """
    weeks = int(prefs.get("weeks") or 6)
    plan_start_date = str(
        prefs.get("plan_start_date")
        or prefs.get("start_date")
        or datetime.utcnow().date().isoformat()
    )

    main_sport = (
        prefs.get("main_sport")
        or (prefs.get("primary_sports") or [None])[0]
        or "run"
    )

    raw: CoachWeeklyPlanInput = {
        "schema_version": 1,
        "prefs": {
            "goal_kind": prefs.get("goal_kind") or prefs.get("goal") or "improve_overall",
            "total_weeks": weeks,
            "plan_start_date": plan_start_date,
            "main_sport": main_sport,
            "secondary_mix": prefs.get("secondary_mix") or [],
            "strength_settings": (prefs.get("strength_settings") or {}),
            "constraints": prefs.get("constraints") or {},
        },
        "athlete_state": (athlete_state or {}).get("ai_state") or {},
        "active_plan": {
            "plan_id": plan_id,
        },
    }
    return raw


# ───────────────────────────── LLM stub ─────────────────────────────


def call_llm_generate_weekly(
    payload: CoachWeeklyPlanInput,
    *,
    model: str = "coach-weekly-stub",
    debug: bool = False,
) -> CoachWeeklyPlan:
    """
    Tu bude reálny weekly-plán prompt.

    Zatiaľ STUB: vytvorí jednoduchých N týždňov na základe prefs.total_weeks.
    """
    prefs = payload.get("prefs") or {}
    total_weeks = int(prefs.get("total_weeks") or 6)
    start_iso = prefs.get("plan_start_date") or datetime.utcnow().date().isoformat()
    start_date = datetime.fromisoformat(start_iso)

    weeks: List[WeeklyWeek] = []
    for i in range(total_weeks):
        ws = (start_date + timedelta(weeks=i)).date()
        we = ws + timedelta(days=6)

        weeks.append(
            WeeklyWeek(
                week_index=i + 1,
                week_start=ws.isoformat(),
                week_end=we.isoformat(),
                goal=f"Week {i+1}: build consistent training",
                focus="increase base Z2 volume",
                load_phase="build",
                planned_km=None,
                planned_minutes=240 + i * 20,
                intensity_mix={
                    "easy_pct": 0.7,
                    "moderate_pct": 0.2,
                    "hard_pct": 0.1,
                },
                sessions_summary={
                    "run": {"total": 4, "key_sessions": 2, "long_runs": 1},
                    "ride": {"total": 0, "key_sessions": 0},
                    "strength": {"total": 2},
                },
                key_sessions=[
                    {
                        "label": "Long run Z2",
                        "type": "run_long_z2",
                        "priority": 1,
                    },
                    {
                        "label": "Threshold workout",
                        "type": "run_threshold",
                        "priority": 1,
                    },
                ],
                notes=None,
            )
        )
    if weeks:
        last_week = weeks[-1]
        plan_end = last_week.get("week_end") or start_iso
    else:
        plan_end = start_iso

    weekly_plan: CoachWeeklyPlan = {
        "schema_version": 1,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "model": model,
        "meta": {
            "goal_kind": prefs.get("goal_kind") or "improve_overall",
            "total_weeks": total_weeks,
            "plan_start_date": start_iso,
            "plan_end_date": plan_end,
        },
        "weeks": weeks,
    }

    if debug:
        print("[COACH-WEEKLY] stub weekly_plan:", weekly_plan)

    return weekly_plan


# ───────────────────────────── mapovanie do DB ─────────────────────────────


def weekly_plan_to_db_rows(
    user_id: int,
    plan_id: str,
    weekly_plan: CoachWeeklyPlan,
) -> List[Dict[str, Any]]:
    """
    Premení CoachWeeklyPlan na riadky pre coach_plan_weekly.
    """
    weeks = weekly_plan.get("weeks") or []
    rows: List[Dict[str, Any]] = []

    for w in weeks:
        rows.append(
            {
                "user_id": user_id,
                "plan_id": plan_id,
                "week_index": int(w.get("week_index") or 0),
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
            }
        )

    return rows