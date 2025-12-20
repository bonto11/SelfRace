# backend/Routes_FE/analytics_pareto8020.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Any, Dict

from Services.analytics_pareto8020 import (
    service_pareto_source,
    service_pareto_widget,
    service_pareto_trend,
)

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])


# --------------------------- SOURCE -----------------------------
@router.get("/source/{user_id}")
def pareto_source(
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True,
) -> Dict[str, Any]:
    """
    Public endpoint pre veľký dataset (na SESSION).
    Zachováva starý tvar response (bez success wrappera).
    """
    try:
        res = service_pareto_source(
            user_id=user_id,
            months=months,
            count_no_hr_as_easy=count_no_hr_as_easy,
        )
        return res
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------- WIDGET -----------------------------
@router.get("/widget/{user_id}")
def pareto_widget(
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
        data = service_pareto_widget(
            user_id=user_id,
            days=days,
            sport=sport,
        )
        return {
            "success": True,
            "data": data,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------- TREND -----------------------------
@router.get("/{user_id}")
def pareto_trend(
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
        rows = service_pareto_trend(
            user_id=user_id,
            weeks=weeks,
            sport=sport,
        )
        return {
            "success": True,
            "data": rows,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))