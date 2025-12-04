# Services/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Configs.config import DEFAULT_MODEL
from Services.coach_athlete_state import build_input_from_db
from Routes_DB.coach_athlete_state import (
    db_get_state_by_id,
    db_get_latest_state_for_user,
)
from Routes_AI.generate_plan_weekly import generate_weekly_plan_json


def _load_athlete_state_for_plan(
    user_id: int,
    state_id: Optional[int],
) -> Dict[str, Any]:
    """
    Nájde vhodný coach_athlete_state pre plánovanie.

    Priority:
      1) explicitný state_id (ak existuje),
      2) najnovší stav pre usera (version=1).

    Keď nič nenájdeme → ValueError (FE dostane 400).
    """
    row: Optional[Dict[str, Any]] = None

    if state_id is not None:
        row = db_get_state_by_id(state_id)

    if not row:
        row = db_get_latest_state_for_user(user_id=user_id, version=1)

    if not row:
        raise ValueError(
            "No athlete state found for this user. "
            "Run /coach/athlete/analyze first or pass a valid state_id."
        )

    state_json = row.get("state_json")
    if not isinstance(state_json, dict):
        raise ValueError("Stored athlete state has invalid format (state_json).")

    # meta + samotný state
    return {
        "state_id": row.get("id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
    }


def service_generate_weekly_plan(
    user_id: int,
    *,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service pre weekly plán.

    - načíta CoachAnalyzeInput z DB (build_input_from_db)
    - nájde vhodný coach_athlete_state (podľa state_id alebo latest)
    - poskladá context_payload pre AI
    - zavolá OpenAI cez Routes_AI.generate_plan_weekly.generate_weekly_plan_json
    - vráti { weekly_plan, state_meta, debug? }
    """
    # 1) vstup pre AI (rovnaký ako pre analyze)
    analyze_input = build_input_from_db(user_id)

    # 2) stav atlétu z analyze
    state_bundle = _load_athlete_state_for_plan(user_id=user_id, state_id=state_id)

    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    # koľko týždňov – preferuj z payloadu, inak z prefs, fallback 6
    prefs = analyze_input.get("prefs") or {}
    horizon_weeks = int(weeks or prefs.get("weeks") or 6)

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "weeks": horizon_weeks,
        "overwrite": overwrite,
        # to isté, čo pri analyze:
        "analyze_input": analyze_input,
        "athlete_state": athlete_state,
        "athlete_state_meta": {
            "state_id": used_state_id,
            "model": state_bundle.get("model"),
            "version": state_bundle.get("version"),
            "created_at": state_bundle.get("created_at"),
        },
    }

    plan_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    weekly_plan, trace = generate_weekly_plan_json(
        context_payload=context_payload,
        model=plan_model,
        debug_raw=debug,
    )

    resp: Dict[str, Any] = {
        "weekly_plan": weekly_plan,
        "state_id": used_state_id,
        "model": plan_model,
        "overwrite": overwrite,
        "weeks": horizon_weeks,
    }
    if debug and trace is not None:
        resp["debug"] = trace

    # zápis do DB weekly plánu si doplníme neskôr – teraz len vrátime AI výstup
    return resp