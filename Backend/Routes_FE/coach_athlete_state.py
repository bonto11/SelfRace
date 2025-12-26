from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Depends

from Services.coach_athlete_state import (
    service_analyze_athlete,
    service_get_latest_athlete_state,
    service_list_athlete_states_meta,
)
from Schemas.coach_athlete_state import AnalyzeConfig
from Configs.config import DEFAULT_MODEL
from Modules.HTTP.auth_deps import require_user_jwt

router = APIRouter(
    prefix="/coach/athlete",
    tags=["coach-athlete"],
)


@router.post("/analyze/{user_id}")
def analyze_athlete(
    user_id: int,
    payload: AnalyzeConfig | None = Body(None),
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Spustí AI analýzu formy pre daného užívateľa.

    FE môže (ale nemusí) poslať payload:
      {
        "debug": bool,            // default false
        "save_to_db": bool,       // default true
        "model": "..."            // default DEFAULT_MODEL
      }
    """
    try:
        debug = bool(payload.debug) if payload and payload.debug is not None else False
        save_to_db = True if not payload or payload.save_to_db is None else bool(payload.save_to_db)
        model = payload.model or DEFAULT_MODEL if payload else DEFAULT_MODEL

        result = service_analyze_athlete(
            user_id=user_id,
            user_jwt=user_jwt,
            debug=debug,
            save_to_db=save_to_db,
            model=model,
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
def get_latest_athlete_state(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Vráti najnovší uložený AI stav atleta pre daného užívateľa.
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