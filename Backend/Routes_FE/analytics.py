# Routes_FE/analytics.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Header
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

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _extract_user_jwt(authorization: Optional[str]) -> Optional[str]:
    """
    Vytiahne Bearer token z Authorization headeru.
    Očakáva tvar: "Bearer <jwt>".
    Ak nie je, vráti None – services/DB si poradia (napr. service-role client).
    """
    if not authorization:
        return None
    try:
        prefix, token = authorization.split(" ", 1)
        if prefix.lower() != "bearer":
            return None
        token = token.strip()
        return token or None
    except Exception:
        return None


@router.get("/weekly/{user_id}", response_model=WeeklyAnalyticsResponse)
def weekly(
    user_id: int,
    weeks: int = 12,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Týždenná agregácia za posledných N týždňov.
    (km/time/TRIMP + Monotony/Strain + hr_used)
    """
    user_jwt = _extract_user_jwt(authorization)

    try:
        payload = service_weekly_analytics(
            user_id=user_id,
            weeks=weeks,
            user_jwt=user_jwt,
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
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Public endpoint pre veľký dataset (na SESSION).
    Zachováva starý tvar response (bez success wrappera).
    """
    user_jwt = _extract_user_jwt(authorization)

    try:
        res = service_pareto_source(
            user_id=user_id,
            months=months,
            count_no_hr_as_easy=count_no_hr_as_easy,
            user_jwt=user_jwt,
        )
        return res
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------- WIDGET -----------------------------
@router.get("/pareto8020/widget/{user_id}")
def pareto_widget(
    user_id: int,
    days: int = 14,
    sport: str = "all",
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Sumár za posledné `days` (číta iba enrichment).
    - ak sport='all' => default PARETO_DEFAULT_SET
    - ak sport='run' alebo 'run,ride' => filtruje tieto športy
    Response shape ostáva:
      { "success": true, "data": { easy_min, hard_min, total_min, days } }
    """
    user_jwt = _extract_user_jwt(authorization)

    try:
        data = service_pareto_widget(
            user_id=user_id,
            days=days,
            sport=sport,
            user_jwt=user_jwt,
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
    user_id: int,
    weeks: int = 8,
    sport: str = "all",
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Trend po týždňoch (posledných `weeks` týždňov) s doplnením prázdnych týždňov nulami.
    Response shape ostáva:
      { "success": true, "data": [ ... ] }
    """
    user_jwt = _extract_user_jwt(authorization)

    try:
        rows = service_pareto_trend(
            user_id=user_id,
            weeks=weeks,
            sport=sport,
            user_jwt=user_jwt,
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
    user_id: int,
    activity_id: int,
    authorization: Optional[str] = Header(None),
):
    user_jwt = _extract_user_jwt(authorization)

    try:
        payload = service_get_activity_detail(
            user_id=user_id,
            activity_id=activity_id,
            user_jwt=user_jwt,
        )
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    


@router.post("/activityStreams/{user_id}/{activity_id}")
def activity_streams_fetch(
    user_id: int,
    activity_id: int,
    fetch: bool = Query(False),  # fetch=true => natiahni zo Stravy ak chýba
    authorization: Optional[str] = Header(None),
):
    user_jwt = _extract_user_jwt(authorization)

    try:
        payload = service_get_streams_cached_or_fetch(
            user_id=user_id,
            activity_id=activity_id,
            fetch_if_missing=bool(fetch),
            user_jwt=user_jwt,
        )

        return {"success": True, **payload}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/activityExtras/{user_id}/{activity_id}")
def activity_extras_fetch(
    user_id: int,
    activity_id: int,
    fetch: bool = Query(False),
    authorization: Optional[str] = Header(None),
):
    user_jwt = _extract_user_jwt(authorization)

    try:
        payload = service_get_activity_extras_cached_or_fetch(
            user_id=user_id,
            activity_id=activity_id,
            fetch_if_missing=bool(fetch),
            user_jwt=user_jwt,
        )
        return {"success": True, **payload}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))