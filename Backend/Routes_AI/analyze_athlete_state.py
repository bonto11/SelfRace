# Routes_AI/analyze_athlete_state.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException

from Services.coach_athlete_state import service_analyze_athlete

router = APIRouter(
    prefix="/coach/athlete",
    tags=["coach-athlete"],
)


@router.post("/analyze/{user_id}")
def analyze_athlete_state(
    user_id: int,
    payload: Dict[str, Any] = Body(
        default={},
        description=(
            "Konfig pre AI analýzu:\n"
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

    - FE posiela len konfig (debug/save_to_db/model).
    - Všetky dáta (profil, prefs, zóny, prahy, bests, recent_load, recovery)
      sa skladajú v Services.coach_athlete_state.build_input_from_db().
    - Výsledok: raw `state` + `input` (payload pre AI) na debug.
    """
    try:
        debug: bool = bool(payload.get("debug", False))

        save_to_db_raw: Optional[bool] = payload.get("save_to_db")
        save_to_db: bool = True if save_to_db_raw is None else bool(save_to_db_raw)

        model: str = str(payload.get("model") or "coach-analyze-stub")

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
        # ak service niekde hodí HTTPException, len ju preposunieme
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))