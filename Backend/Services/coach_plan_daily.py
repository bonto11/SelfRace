# Services/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Configs.config import DEFAULT_MODEL
from Services.coach_athlete_state import build_input_from_db
from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_AI.generate_plan_daily import generate_daily_week_json


def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str] = None,
    overwrite: bool = True,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Generovanie daily plánu pre konkrétny týždeň.

    Zatiaľ:
      - nepotrebuje existujúcu weekly DB tabuľku,
      - vezme analyze_input + posledný athlete_state,
      - week_index a plan_id používa len ako hint pre AI.

    Neskôr sem vieme doplniť:
      - čítanie weekly plánu z DB podľa plan_id,
      - zápis vygenerovaných daily sessions do DB.
    """
    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    analyze_input = build_input_from_db(user_id)

    state_row = db_get_latest_state_for_user(user_id=user_id, version=1)
    athlete_state = (state_row or {}).get("state_json") or None

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "week_index": week_index,
        "plan_id": plan_id,
        "overwrite": overwrite,
        "analyze_input": analyze_input,
        "athlete_state": athlete_state,
    }

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    daily_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "week_index": week_index,
        "plan_id": plan_id,
        "model": daily_model,
        "overwrite": overwrite,
    }
    if debug and trace is not None:
        resp["debug"] = trace

    return resp