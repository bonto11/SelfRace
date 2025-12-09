# Routes/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from Services.coach_plan_active import (
    service_save_active_plan,
    service_cancel_active_plan,
    service_continue_active_plan,
    service_extend_active_plan,
    service_link_activity,
)

router = APIRouter()


# ----------------------------------------------------
# POST /coach-plan-active/{user_id}/save
# ----------------------------------------------------
@router.post("/coach-plan-active/{user_id}/save")
async def save_active_plan(
    user_id: int,
    payload: Dict[str, Any],
):
    """
    FE posiela prázdny objekt alebo drobné meta – BE si nájde
    najnovší plan v coach_plan_meta a aktivuje ho.
    """
    try:
        result = service_save_active_plan(user_id, payload)
        return {
            "success": True,
            "plan_id": result.get("plan_id"),
            "plan_start": result.get("plan_start"),
            "plan_end": result.get("plan_end"),
            "weeks": result.get("weeks"),
            "meta": result.get("meta"),
        }
    except ValueError as e:
        # typicky: nemáme žiadny generated plan
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"save_active_plan ERROR: {str(e)}")


# ----------------------------------------------------
# DELETE /coach-plan-active/{user_id}/cancel
# ----------------------------------------------------
@router.delete("/coach-plan-active/{user_id}/cancel")
async def cancel_active_plan(
    user_id: int,
    payload: Dict[str, Any],
):
    plan_id: Optional[str] = payload.get("plan_id")
    deleted = service_cancel_active_plan(user_id, plan_id)
    return {"success": True, "deleted": deleted}


# ----------------------------------------------------
# PATCH /coach-plan-active/{user_id}/continue
# ----------------------------------------------------
@router.patch("/coach-plan-active/{user_id}/continue")
async def continue_active_plan(
    user_id: int,
    payload: Dict[str, Any],
):
    min_days = int(payload.get("min_horizon_days", 10))
    result = service_continue_active_plan(user_id, min_horizon_days=min_days)
    return result


# ----------------------------------------------------
# POST /coach-plan-active/{user_id}/extend
# ----------------------------------------------------
@router.post("/coach-plan-active/{user_id}/extend")
async def extend_active_plan(
    user_id: int,
    min_horizon_days: int = 10,
):
    result = service_extend_active_plan(user_id, min_horizon_days=min_horizon_days)
    return result

# ----------------------------------------------------
# POST /coach-plan-active/{user_id}/link
# ----------------------------------------------------
@router.post("/coach-plan-active/{user_id}/link")
async def link_activity(
    user_id: int,
    payload: Dict[str, Any],
):
    session_id_raw = payload.get("session_id")
    if session_id_raw is None:
        raise HTTPException(status_code=400, detail="session_id must be provided")

    # safe cast
    try:
        session_id = int(session_id_raw)
    except Exception:
        raise HTTPException(status_code=400, detail="session_id must be int")

    activity_id_raw = payload.get("activity_id", None)
    activity_id: Optional[int]
    if activity_id_raw is None:
        activity_id = None
    else:
        try:
            activity_id = int(activity_id_raw)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="activity_id must be int or null",
            )

    ok = service_link_activity(user_id, session_id, activity_id)
    return {"success": ok}