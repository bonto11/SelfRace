# Routes_FE/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, Header

from Schemas.coach_plan_weekly import WeeklyGenerateConfig
from Services.coach_plan_weekly import (
    service_generate_weekly_plan,
    service_get_latest_weekly_plan,
)

router = APIRouter(
    prefix="/coach-plan-weekly",
    tags=["coach-plan-weekly"],
)


def _extract_user_jwt(
    request: Request,
    authorization: str | None,
) -> str:
    """
    Zoberie JWT z:
      - Authorization: Bearer <token>
      - alebo z cookies (sb-access-token / sb:token)

    Ak nič nie je → 401.
    """
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token:
            return token

    token = request.cookies.get("sb-access-token") or request.cookies.get("sb:token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    return token


@router.post("/generate/{user_id}")
def generate_weekly_plan(
    user_id: int,
    payload: WeeklyGenerateConfig,
    request: Request,
    authorization: str | None = Header(None),
) -> Dict[str, Any]:
    """
    Vygeneruje / prepíše weekly plán pre daného usera.

    Volá Services.coach_plan_weekly.service_generate_weekly_plan.
    """
    user_jwt = _extract_user_jwt(request, authorization)

    try:
        result = service_generate_weekly_plan(
            user_id=user_id,
            user_jwt=user_jwt,
            overwrite=payload.overwrite,
            state_id=payload.state_id,
            weeks=payload.weeks,
            model=payload.model,
            debug=payload.debug,
        )
        return {"success": True, **result}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest/{user_id}")
def get_latest_weekly_plan(
    user_id: int,
    request: Request,
    authorization: str | None = Header(None),
) -> Dict[str, Any]:
    """
    Vráti najnovší weekly plán pre daného usera (alebo None).

    Response:
      {
        "success": true,
        "plan": {
          "plan_id": "...",
          "weeks": [ ... ]
        } | None
      }
    """
    user_jwt = _extract_user_jwt(request, authorization)

    try:
        plan = service_get_latest_weekly_plan(
            user_id=user_id,
            user_jwt=user_jwt,
        )
        return {
            "success": True,
            "plan": plan,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))