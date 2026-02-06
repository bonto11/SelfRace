from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Depends, Request

from Services.AI.athlete_state import (
    service_analyze_athlete,
    service_get_latest_athlete_state,
    service_list_athlete_states_meta,
    service_get_latest_athlete_progress,
)
from Schemas.coach_athlete_state import AnalyzeConfig
from Modules.HTTP.auth_deps import require_user_jwt
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(
    prefix="/coach/athlete",
    tags=["coach-athlete"],
)

@router.post("/analyze/{user_id}")
def analyze_athlete(
    req: Request,
    user_id: int,
    payload: AnalyzeConfig | None = Body(None),
):
    """
    Spustí AI analýzu formy pre daného užívateľa.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        if payload and payload.model:
            model = payload.model

        result = service_analyze_athlete(
            user_id=user_id,
            ctx=ctx,
            model=model,
        )
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/latest/{user_id}")
def get_latest_athlete_state(
    req: Request,
    user_id: int,
):
    """
    Vráti najnovší uložený AI stav atleta pre daného užívateľa.
    Ide cez RLS/JWT.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        row = service_get_latest_athlete_state(
            user_id=user_id,
            ctx=ctx,
            version=1,
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
    req: Request,
    user_id: int,
    limit: int = 20,
):
    """
    História AI stavov – len meta info (bez state_json).
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        rows = service_list_athlete_states_meta(
            user_id=user_id,
            limit=limit,
            ctx=ctx,
        )
        return {"success": True, "items": rows}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/state/latest-progress/{user_id}")
def get_latest_athlete_progress(
    req: Request,
    user_id: int,
):
    """
    Vráti najnovší AI progress report (porovnanie posledných dvoch stavov).
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        row = service_get_latest_athlete_progress(
            user_id=user_id,
            version=1,
            ctx=ctx,
        )
        return {
            "success": True,
            "item": row,  # <- presne to, čo čaká FE apiGetLatestAthleteProgress
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
