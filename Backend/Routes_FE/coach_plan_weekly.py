# Routes_FE/coach_plan_weekly.py
from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, Body, HTTPException
from Services.coach_plan_weekly import service_generate_weekly_plan

router = APIRouter(prefix="/coach-plan-weekly", tags=["coach-plan-weekly"])


@router.post("/generate/{user_id}")
def generate_weekly_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(
        ...,
        description=(
            "Weekly plan generation input:\n"
            "{\n"
            '  "athlete_state": {...},   # CoachAthleteState alebo jeho časť\n'
            '  "prefs": {...},           # CoachPrefs / goal, weeks, start_date...\n'
            '  "plan_id": str | null,    # optional – ak chceš pokračovať v existujúcom pláne\n'
            '  "model": str,             # optional (default "coach-weekly-stub")\n'
            '  "save_to_db": bool,       # optional (default True)\n'
            '  "debug": bool             # optional (default False)\n'
            "}"
        ),
    ),
):
    """
    Vygeneruje WEEKLY plán (coach_plan_weekly) pomocou service_generate_weekly_plan.

    - ak plan_id je None -> service si vytvorí nový UUID
    - ak save_to_db = True -> staré weekly riadky pre plan_id sa zmažú a vložia nové
    """
    athlete_state = payload.get("athlete_state") or {}
    prefs = payload.get("prefs") or {}

    if not isinstance(athlete_state, dict):
        raise HTTPException(status_code=400, detail="athlete_state must be an object")
    if not isinstance(prefs, dict):
        raise HTTPException(status_code=400, detail="prefs must be an object")

    plan_id = payload.get("plan_id")
    model = payload.get("model") or "coach-weekly-stub"
    save_to_db = bool(payload.get("save_to_db", True))
    debug = bool(payload.get("debug", False))

    try:
        result = service_generate_weekly_plan(
            user_id=user_id,
            athlete_state=athlete_state,
            prefs=prefs,
            plan_id=plan_id,
            model=model,
            save_to_db=save_to_db,
            debug=debug,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": True,
        **result,
    }