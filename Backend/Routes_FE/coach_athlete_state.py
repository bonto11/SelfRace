# Routes_FE/coach_athlete_state.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException

from Services.coach_athlete_state import service_analyze_athlete

router = APIRouter(
    prefix="/coach/athlete",
    tags=["coach-athlete"],
)


@router.post("/analyze/{user_id}")
def analyze_athlete(
    user_id: int,
    payload: Dict[str, Any] = Body(
        default={},
        description=(
            "Optional config:\n"
            "{\n"
            '  "debug": bool (default false),\n'
            '  "save_to_db": bool (default true),\n'
            '  "model": str (default \"coach-analyze-stub\")\n'
            "}"
        ),
    ),
):
    """
    Spustí AI analýzu formy pre daného užívateľa.

    Volá service_analyze_athlete, ktorý:
      - poskladá CoachAnalyzeInput (zatím stub z konstánt + user_id)
      - zavolá LLM (stub) → CoachAthleteState
      - voliteľne uloží do coach_athlete_state
      - vráti:
          {
            "success": True,
            "state_id": int | None,
            "state": CoachAthleteState,
            "input": CoachAnalyzeInput,
            "model": str,
          }
    """
    debug = bool(payload.get("debug") or False)

    save_to_db_raw = payload.get("save_to_db")
    save_to_db = True if save_to_db_raw is None else bool(save_to_db_raw)

    model = str(payload.get("model") or "coach-analyze-stub")

    try:
        result = service_analyze_athlete(
            user_id=user_id,
            model=model,
            save_to_db=save_to_db,
            debug=debug,
        )
        return {
            "success": True,
            **result,
        }
    except HTTPException:
        # pre prípad, že service niekedy bude hádzať HTTPException
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))