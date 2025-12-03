# Routes_FE/coach_athlete_state.py
from __future__ import annotations


from fastapi import APIRouter, Body, HTTPException

from Services.coach_athlete_state import service_analyze_athlete
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
