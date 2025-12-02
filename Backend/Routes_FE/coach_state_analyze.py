# Routes_FE/coach_state.py
from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, Body, HTTPException
from Services.coach_athlete_analyze import service_analyze_athlete

router = APIRouter(prefix="/coach-state", tags=["coach-state"])


@router.post("/analyze/{user_id}")
def analyze_state(
    user_id: int,
    payload: Dict[str, Any] = Body(
        default={},
        description=(
            "Optional config:\n"
            "{\n"
            '  "model": str (default "coach-analyze-stub"),\n'
            '  "save_to_db": bool (default True),\n'
            '  "debug": bool (default False)\n'
            "}"
        ),
    ),
):
    """
    Spustí AI analýzu formy pre daného užívateľa.

    Volá service_analyze_athlete, ktorý:
      - poskladá AnalyzeInput z DB (zatiaľ STUB)
      - zavolá LLM / stub a vygeneruje athlete_state
      - (voliteľne) uloží do coach_athlete_state
      - vráti: { state_id, state, input, model }
    """
    model = payload.get("model") or "coach-analyze-stub"
    save_to_db = bool(payload.get("save_to_db", True))
    debug = bool(payload.get("debug", False))

    try:
        result = service_analyze_athlete(
            user_id=user_id,
            model=model,
            save_to_db=save_to_db,
            debug=debug,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return result