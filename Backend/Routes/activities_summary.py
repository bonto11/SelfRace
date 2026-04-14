# Routes_FE/activities_summary.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from Services.activities_summary import (
    service_activities_in_range,
    service_select_activities,
)

from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/activities_summary", tags=["activities_summary"])

@router.get("/range/{user_id}")
def activities_in_range(
    req: Request,
    user_id: int,
    start: str,
    end: str,
):
    """
    Aktivity v rozsahu [start, end] vrátane.
    FE-only: vyžaduje Bearer JWT.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        payload = service_activities_in_range(
            ctx=ctx,
            user_id=user_id,
            start=start,
            end=end,
        )

        return {"success": True, **payload}

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/select/{user_id}")
def select_activities(
    req: Request,
    user_id: int,
    date: str = Query(..., description="YYYY-MM-DD"),
    delta_days: int = Query(1, ge=0, le=7),
    sports: str = Query("run,mixed", description="comma-separated sport_type_fe"),
):
    """
    Minimal payload pre picker.
    FE-only: vyžaduje Bearer JWT.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        payload = service_select_activities(
            ctx=ctx,
            user_id=user_id,
            date_str=date,
            delta_days=delta_days,
            sports_csv=sports,
        )
        return {"success": True, **payload}

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        print("❌ select_activities error:", e)
        raise HTTPException(status_code=500, detail=str(e))