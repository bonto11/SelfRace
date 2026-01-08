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
    service_get_activity_detail,
)

from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
    backfill_enrichment_for_period,
)

from Schemas.analytics import WeeklyAnalyticsResponse

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


"""
# ZÓNY – ak ich budeš znovu zapínať, už tu máš aj JWT pattern.

class ZonesReq(BaseModel):
    ids: List[int]
    fetch: Optional[bool] = True


# POST – JSON body s ids, fetch; aliasujeme aj starú cestu /streams/zones/{user_id}
@router.post("/zones/{user_id}")
def zones_preview_post(
    user_id: int,
    body: ZonesReq,
    authorization: Optional[str] = Header(None),
):
    user_jwt = _extract_user_jwt(authorization)

    res = preview_zones_for_activities(
        user_id=user_id,
        activity_ids=body.ids or [],
        fetch_if_missing=bool(body.fetch),
        user_jwt=user_jwt,
    )
    return res


# GET – query ids, fetch, save; alias pre starý path
@router.get("/zones/{user_id}")
def zones_preview_get(
    user_id: int,
    ids: str = Query(..., description="CSV activity_id (napr. 161...,101...)"),
    fetch: int = 0,  # 1 = dotiahni chýbajúce streams zo Stravy a ulož do activities_streams
    save: int = 0,  # 1 = zapíš minúty do activities_enrichment
    authorization: Optional[str] = Header(None),
):
    user_jwt = _extract_user_jwt(authorization)

    try:
        activity_ids = [int(x) for x in ids.split(",") if x.strip()]
        print(f"[zones] user={user_id} ids={activity_ids} fetch={fetch} save={save}")

        preview = preview_zones_for_activities(
            user_id=user_id,
            activity_ids=activity_ids,
            fetch_if_missing=bool(fetch),
            user_jwt=user_jwt,
        )

        saved = 0
        if save and preview.get("items"):
            res = upsert_enrichment_minutes(
                user_id=user_id,
                items=preview["items"],
                user_jwt=user_jwt,
            )
            saved = int(res.get("saved", 0))
            print(f"[zones] saved rows={saved}")

        return {**preview, "saved": saved}
    except Exception as e:
        print("[zones] error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/backfill/{user_id}")
def backfill_zones_route(
    user_id: int,
    months: int = 3,
    fetch: int = 1,  # 1 = dotiahni chýbajúce streamy zo Stravy
    save: int = 1,  # 1 = ulož do activities_enrichment
    batch: int = 25,
    authorization: Optional[str] = Header(None),
):
    user_jwt = _extract_user_jwt(authorization)

    res = backfill_enrichment_for_period(
        user_id=user_id,
        months=months,
        fetch_if_missing=bool(fetch),
        save=bool(save),
        batch=batch,
        user_jwt=user_jwt,
    )
    return res
"""
