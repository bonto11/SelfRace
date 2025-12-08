# Routes/coach_plan_active.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any, List

from Services.coach_plan_active import (
    service_save_active_plan,
    service_cancel_active_plan,
    service_continue_active_plan,
    service_extend_active_plan,
    service_reorder_daily_sessions,
    service_link_activity,
)

router = APIRouter()

# ----------------------------------------------------
# POST /coach-plan/{user_id}
# 1) SAVE ACTIVE PLAN
# 2) LINK ACTIVITY (session_id + activity_id)
# ----------------------------------------------------

@router.post("/coach-plan/{user_id}")
async def save_or_link_active_plan(
    user_id: int,
    payload: Dict[str, Any],
):
    """
    FE používa tento endpoint dvojmo:

    1) SAVE ACTIVE PLAN (obsahuje weekly/meta/next_10_days)
    2) LINK ACTIVITY (obsahuje session_id + activity_id)
    """
    # ---------- CASE 2: LINK ACTIVITY ----------
    if "session_id" in payload:
        session_id_raw = payload.get("session_id")
        activity_id_raw = payload.get("activity_id", None)

        # bezpečný casting na int, alebo error
        try:
            session_id: int = int(session_id_raw)
        except Exception:
            raise HTTPException(status_code=400, detail="session_id must be int")

        try:
            activity_id: Optional[int] = (
                int(activity_id_raw) if activity_id_raw is not None else None
            )
        except Exception:
            raise HTTPException(status_code=400, detail="activity_id must be int or null")

        ok = service_link_activity(
            user_id=user_id,
            session_id=session_id,
            activity_id=activity_id,
        )

        return {"success": ok}

    # ---------- CASE 1: SAVE ACTIVE PLAN ----------
    try:
        result = service_save_active_plan(user_id, payload)
        return {
            "success": True,
            "plan_id": result.get("plan_id"),
            "weeks": result.get("weeks"),
            "meta": result.get("meta"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"save_active_plan ERROR: {str(e)}")


# ----------------------------------------------------
# DELETE /coach-plan/{user_id}
# ----------------------------------------------------
@router.delete("/coach-plan/{user_id}")
async def cancel_active_plan(
    user_id: int,
    payload: Dict[str, Any]
):
    plan_id = payload.get("plan_id")
    deleted = service_cancel_active_plan(user_id, plan_id)
    return {"success": True, "deleted": deleted}


# ----------------------------------------------------
# PATCH /coach-plan/{user_id}  (continue)
# ----------------------------------------------------
@router.patch("/coach-plan/{user_id}")
async def continue_plan(user_id: int, payload: Dict[str, Any]):
    min_days = int(payload.get("min_horizon_days", 10))
    result = service_continue_active_plan(user_id, min_days=min_days)
    return result


# ----------------------------------------------------
# POST /coach-plan/{user_id}/extend
# ----------------------------------------------------
@router.post("/coach-plan/{user_id}/extend")
async def extend_plan(user_id: int, min_horizon_days: int = 10):
    result = service_extend_active_plan(user_id, min_horizon_days=min_horizon_days)
    return result


# ----------------------------------------------------
# POST /coach-plan/{user_id}/reorder
# ----------------------------------------------------
@router.post("/coach-plan/{user_id}/reorder")
async def reorder_daily_sessions(
    user_id: int,
    payload: Dict[str, Any],
):
    updates: List[Dict[str, Any]] = payload.get("updates", [])
    ok = service_reorder_daily_sessions(user_id, updates)
    return {"success": ok}