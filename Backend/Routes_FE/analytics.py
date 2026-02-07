# Routes_FE/analytics.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Header, Request
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from Services.analytics_weekly import service_weekly_analytics
from Services.analytics_pareto8020 import (
    service_pareto_source,
    service_pareto_widget,
    service_pareto_trend,
)

from Services.analytics import (
    service_get_activity_detail,service_get_activity_extras_cached_or_fetch
)
from Schemas.analytics import WeeklyAnalyticsResponse
from Services.activities_streams import service_get_streams_cached_or_fetch  # podľa toho kde to dáš
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/weekly/{user_id}", response_model=WeeklyAnalyticsResponse)
def weekly(
    req: Request,
    user_id: int,
    weeks: int = 12,
) -> Dict[str, Any]:
    """
    Týždenná agregácia za posledných N týždňov.
    (km/time/TRIMP + Monotony/Strain + hr_used)
    """
    try:

        ctx = require_user(get_auth_ctx(req))

        payload = service_weekly_analytics(
            user_id=user_id,
            weeks=weeks,
            ctx=ctx,
        )
   
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        print(f"[ANALYTICS] weekly failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------- SOURCE -----------------------------
@router.get("/pareto8020/source/{user_id}")
def pareto_source(
    req: Request,
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True,
) -> Dict[str, Any]:
    """
    Public endpoint pre veľký dataset (na SESSION).
    Zachováva starý tvar response (bez success wrappera).
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        res = service_pareto_source(
            user_id=user_id,
            months=months,
            count_no_hr_as_easy=count_no_hr_as_easy,
            ctx=ctx,
        )
        return res
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------- WIDGET -----------------------------
@router.get("/pareto8020/widget/{user_id}")
def pareto_widget(
    req: Request,
    user_id: int,
    days: int = 14,
    sport: str = "all",
) -> Dict[str, Any]:
    """
    Sumár za posledné `days` (číta iba enrichment).
    - ak sport='all' => default PARETO_DEFAULT_SET
    - ak sport='run' alebo 'run,ride' => filtruje tieto športy
    Response shape ostáva:
      { "success": true, "data": { easy_min, hard_min, total_min, days } }
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        data = service_pareto_widget(
            user_id=user_id,
            days=days,
            sport=sport,
            ctx=ctx,
        )
        
        return {
            "success": True,
            "data": data,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------- TREND -----------------------------
@router.get("/pareto8020/{user_id}")
def pareto_trend(
    req: Request,
    user_id: int,
    weeks: int = 8,
    sport: str = "all",
) -> Dict[str, Any]:
    """
    Trend po týždňoch (posledných `weeks` týždňov) s doplnením prázdnych týždňov nulami.
    Response shape ostáva:
      { "success": true, "data": [ ... ] }
    """

    try:
        ctx = require_user(get_auth_ctx(req))

        rows = service_pareto_trend(
            user_id=user_id,
            weeks=weeks,
            sport=sport,
            ctx=ctx,
        )

        return {
            "success": True,
            "data": rows,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# GET: detail (summary + laps + splits)
@router.get("/activitiesDetail/{user_id}/{activity_id}")
def get_activity_detail(
    req: Request,
    user_id: int,
    activity_id: int,
):
    try:
        ctx = require_user(get_auth_ctx(req))

        payload = service_get_activity_detail(
            user_id=user_id,
            activity_id=activity_id,
            ctx=ctx,
        )
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    


@router.post("/activityStreams/{user_id}/{activity_id}")
def activity_streams_fetch(
    req: Request,
    user_id: int,
    activity_id: int,
):
    try:
        ctx = require_user(get_auth_ctx(req))

        payload = service_get_streams_cached_or_fetch(
            user_id=user_id,
            activity_id=activity_id,
            ctx=ctx,
        )

        return {"success": True, **payload}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/activityExtras/{user_id}/{activity_id}")
def activity_extras_fetch(
    req: Request,
    user_id: int,
    activity_id: int,
):

    try:
        ctx = require_user(get_auth_ctx(req))

        payload = service_get_activity_extras_cached_or_fetch(
            user_id=user_id,
            activity_id=activity_id,
            ctx=ctx,
        )
        return {"success": True, **payload}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))