from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Depends

from Services.coach_athlete_state import (
    service_analyze_athlete,
    service_get_latest_athlete_state,
    service_list_athlete_states_meta,
    service_get_latest_athlete_progress,
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
    """
    try:
        debug = bool(payload.debug) if payload and payload.debug is not None else False
        save_to_db = (
            True
            if not payload or payload.save_to_db is None
            else bool(payload.save_to_db)
        )
        model = DEFAULT_MODEL
        if payload and payload.model:
            model = payload.model

        result = service_analyze_athlete(
            user_id=user_id,
            user_jwt=user_jwt,
            debug=debug,
            save_to_db=save_to_db,
            model=model,
        )
        return {"success": True, **result}
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
    Ide cez RLS/JWT.
    """
    try:
        row = service_get_latest_athlete_state(
            user_id=user_id,
            version=1,
            user_jwt=user_jwt,
        )
        return {
            "success": True,
            "state": row,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/history/{user_id}")
def list_athlete_states_meta(
    user_id: int,
    limit: int = 20,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    História AI stavov – len meta info (bez state_json).
    """
    try:
        rows = service_list_athlete_states_meta(
            user_id=user_id,
            limit=limit,
            user_jwt=user_jwt,
        )
        return {"success": True, "items": rows}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/latest-progress/{user_id}")
def get_latest_athlete_progress(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Vráti posledný progress report (compare_previous) pre daného užívateľa.
    Widget si z tohto číta weekly progress.
    """
    try:
        row = service_get_latest_athlete_progress(
            user_id=user_id,
            version=1,
            user_jwt=user_jwt,
        )
        print("get_latest_athlete_progress row",row)
        return {
            "success": True,
            "progress": row,  # môže byť None, ak ešte nie je žiadne porovnanie
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))