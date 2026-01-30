# Routes_FE/activities_summary.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Depends

from Services.activities_summary import (
    service_get_activities,
    service_activities_in_range,
    service_select_activities,
    service_get_summary_one,
)

from Modules.HTTP.auth_deps import require_user_jwt

router = APIRouter(prefix="/activities_summary", tags=["activities_summary"])

# ───────────────────────────── Activities – basic list/detail ─────────────────────────────

# MBP USED
@router.get("/range/{user_id}")
def activities_in_range(
    user_id: int,
    start: str,
    end: str,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Aktivity v rozsahu [start, end] vrátane.
    """
    try:
        payload = service_activities_in_range(
            user_id=user_id,
            start=start,
            end=end,
            user_jwt=user_jwt,
        )

        print("activities_in_range payload",payload)
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# MBP USED
@router.get("/select/{user_id}")
def select_activities(
    user_id: int,
    date: str = Query(..., description="YYYY-MM-DD"),
    delta_days: int = Query(1, ge=0, le=7),
    sports: str = Query("run,mixed", description="comma-separated sport_type_fe"),
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Vráti aktivity v okne ±delta_days od dátumu (vrátane),
    filtrované podľa sport_type_fe (CSV). Minimal payload pre picker.
    """
    try:
        payload = service_select_activities(
            user_id=user_id,
            date_str=date,
            delta_days=delta_days,
            sports_csv=sports,
            user_jwt=user_jwt,
        )
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        print("❌ select_activities error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# Ak ich budeš chcieť znovu používať, už sú pripravené na JWT:

"""
@router.get("/multiple/{user_id}")
def get_activities(
    user_id: int,
    days: int = 30,
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        data = service_get_activities(
            user_id=user_id,
            days=days,
            user_jwt=user_jwt,
        )
        return {"success": True, "data": data}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/single/{activity_id}")
def get_summary_one(
    activity_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    try:
        summary = service_get_summary_one(
            activity_id=activity_id,
            user_jwt=user_jwt,
        )
        return {"success": True, "summary": summary}
    except ValueError:
        raise HTTPException(status_code=404, detail="activity not found")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
"""