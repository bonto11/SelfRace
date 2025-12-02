# Routes_FE/coach_athlete_state.py
from __future__ import annotations

from typing import Any, Dict, Optional

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
            "Config + voliteľný FE payload:\n"
            "{\n"
            '  "debug": bool (default false),\n'
            '  "save_to_db": bool (default true),\n'
            '  "model": str (default \"coach-analyze-stub\"),\n'
            "  ...any FE payload fields (prefs/zones/bests/etc.)\n"
            "}"
        ),
    ),
):
    """
    Spustí AI analýzu formy pre daného užívateľa.

    Očakávané správanie:
      - z payloadu zoberieme len konfig (debug/save_to_db/model)
      - zvyšok payloadu (prefs/zones/bests/...) posunieme ako `fe_payload`
      - service_analyze_athlete:
          * postaví CoachAnalyzeInput (kombinácia stub + fe_payload)
          * zavolá LLM (aktuálne stub) → CoachAthleteState
          * (ak save_to_db) uloží do coach_athlete_state
          * vráti dict:
              {
                "state_id": int | None,
                "state": CoachAthleteState,
                "input": CoachAnalyzeInput,
                "model": str,
              }

    FE očakáva odpoveď:
      { "success": true, "state_id": ..., "state": ..., "input": ..., "model": ... }
    """
    # vyber konfig z payloadu, zvyšok je "fe_payload" pre service
    debug = bool(payload.pop("debug", False))

    save_to_db_raw: Optional[bool] = payload.pop("save_to_db", None)
    save_to_db = True if save_to_db_raw is None else bool(save_to_db_raw)

    model = str(payload.pop("model", "coach-analyze-stub") or "coach-analyze-stub")

    # zvyšok payloadu je to, čo prišlo z FE (prefs/zones/bests/...)
    fe_payload: Optional[Dict[str, Any]] = payload or None

    try:
        result = service_analyze_athlete(
            user_id=user_id,
            model=model,
            save_to_db=save_to_db,
            debug=debug,
            fe_payload=fe_payload,
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