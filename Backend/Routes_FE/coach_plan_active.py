# Routes/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from Services.coach_plan_active import (
    service_save_active_plan,
    service_cancel_active_plan,
    service_continue_active_plan,
    service_extend_active_plan,
    service_link_activity,
    service_get_active_plan_status
)

from Routes_DB.coach_plan_daily import db_get_planned_range_rows

router = APIRouter()

# ----------------------------------------------------
# POST /coach-plan-active/{user_id}/save
# ----------------------------------------------------
@router.post("/coach-plan-active/{user_id}/save")
async def save_active_plan(
    user_id: int,
    payload: Dict[str, Any],
):
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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"save_active_plan ERROR: {str(e)}")

# ----------------------------------------------------
# DELETE /coach-plan-active/{user_id}/cancel
# ----------------------------------------------------
@router.post("/coach-plan-active/{user_id}/cancel")
async def cancel_active_plan(user_id: int):
    try:
        result = service_cancel_active_plan(user_id)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"cancel_active_plan ERROR: {e}")

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

@router.get("/coach-plan/{user_id}")
def get_plan_range(
    user_id: int,
    date_from: str = Query(..., alias="date_from"),
    date_to: str = Query(..., alias="date_to"),
) -> Dict[str, Any]:
    """
    Vráti všetky plánované sessions (coach_plan_daily) pre usera
    v danom dátumovom intervale.

    Používa sa v PlanDataProvider na kalendár / detail.
    """
    try:
        rows = db_get_planned_range_rows(user_id=user_id, date_from=date_from, date_to=date_to)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"get_plan_range ERROR: {e}")

    return {
        "success": True,
        "rows": rows,
    }

@router.get("/coach-plan-active/{user_id}/status")
async def get_active_plan_status(user_id: int) -> Dict[str, Any]:
    """
    Vráti info, či má user aktívny plán.
    """
    try:
        status = service_get_active_plan_status(user_id)
        return {
            "success": True,
            **status,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"get_active_plan_status ERROR: {e}")