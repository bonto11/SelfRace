# Routes_FE/coach_athlete_state.py
from __future__ import annotations


from fastapi import APIRouter, Body, HTTPException

from Services.coach_athlete_state import (
    service_analyze_athlete,
    service_get_latest_athlete_state,
    service_list_athlete_states_meta,
)
from Schemas.coach_athlete_state import AnalyzeConfig
from Configs.config import DEFAULT_MODEL

router = APIRouter(
    prefix="/coach/athlete",
    tags=["coach-athlete"],
)


@router.post("/analyze/{user_id}")
def analyze_athlete(
    user_id: int,
):
    """
    Spustí AI analýzu formy pre daného užívateľa.

    FE neposiela žiadny payload (prefs/zones/bests/...).
    Všetko si BE natiahne z DB podľa user_id.

    Request body (voliteľný):
      {
        "debug": bool,            // default false
        "save_to_db": bool,       // default true
        "model": "coach-analyze-stub" | ...
      }

    Response:
      { "success": true, "state_id": ..., "state": ..., "input": ..., "model": ... }
    """
    try:
        result = service_analyze_athlete(
            user_id=user_id
        )
        return {
            "success": True,
            **result,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state/latest/{user_id}")
def get_latest_athlete_state(user_id: int):
    """
    Vráti najnovší uložený AI stav atleta pre daného užívateľa.

    Response:
      {
        "success": true,
        "state": {
          "id": ...,
          "user_id": ...,
          "model": "...",
          "version": 1,
          "created_at": "...",
          "state": { ... AI analysis JSON ... }
        }
      }
    """
    try:
        row = service_get_latest_athlete_state(user_id=user_id, version=1)
        if not row:
            return {
                "success": True,
                "state": None,
            }
        return {
            "success": True,
            "state": row,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))