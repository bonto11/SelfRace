# Routes_FE/coach-plan-daily.py
from __future__ import annotations
from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, HTTPException
from Services.coach_plan_daily import service_generate_daily_week

router = APIRouter(prefix="/coach-plan-daily", tags=["coach-plan-daily"])


@router.post("/generate/{user_id}")
def generate_daily_for_week(
    user_id: int,
    payload: Dict[str, Any] = Body(
        ...,
        description=(
            "Generovanie denných tréningov pre konkrétny týždeň weekly plánu:\n"
            "{\n"
            '  "plan_id": str,                 # plan_id weekly plánu\n'
            '  "week_context": {...},          # objekt z weekly_plan.weeks[i]\n'
            '  "athlete_state": {...},         # CoachAthleteState alebo jeho časť\n'
            '  "prefs": {...},                 # CoachPrefs / constraints\n'
            '  "existing_days": [...],         # optional – ak chceš zohľadniť existujúce dni\n'
            '  "overwrite": bool,              # default True – zmaže rozsah týždňa a prepíše\n'
            '  "model": str,                   # default "coach-daily-week-stub"\n'
            '  "debug": bool                   # default False\n'
            "}"
        ),
    ),
):
    """
    Rozbije jeden týždeň z weekly plánu na konkrétne denné tréningy
    a uloží ich do coach_plan_daily.
    """
    plan_id = payload.get("plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id is required")

    week_context = payload.get("week_context") or {}
    athlete_state = payload.get("athlete_state") or {}
    prefs = payload.get("prefs") or {}
    existing_days = payload.get("existing_days") or None

    if not isinstance(week_context, dict):
        raise HTTPException(status_code=400, detail="week_context must be an object")
    if not isinstance(athlete_state, dict):
        raise HTTPException(status_code=400, detail="athlete_state must be an object")
    if not isinstance(prefs, dict):
        raise HTTPException(status_code=400, detail="prefs must be an object")

    overwrite = bool(payload.get("overwrite", True))
    model = payload.get("model") or "coach-daily-week-stub"
    debug = bool(payload.get("debug", False))

    try:
        result = service_generate_daily_week(
            user_id=user_id,
            plan_id=plan_id,
            week_context=week_context,
            athlete_state=athlete_state,
            prefs=prefs,
            existing_days=existing_days,
            model=model,
            overwrite=overwrite,
            save_to_db=True,
            debug=debug,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    start = result.get("start")
    end = result.get("end")

    return {
        "success": True,
        "plan_id": result.get("plan_id"),
        "week_index": result.get("week_index"),
        "date_range": {
            "from": start.isoformat() if start else None,
            "to": end.isoformat() if end else None,
        },
        "inserted": result.get("inserted", 0),
        "daily_plan": result.get("daily_plan"),
    }