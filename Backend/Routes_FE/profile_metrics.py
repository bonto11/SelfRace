# Routes_FE/profile_metrics.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Depends, HTTPException

from Services.profile_metrics import (
    service_insert_metrics,
    service_get_metric_history,
    service_get_latest_metrics,
    service_get_vo2_history,
    service_get_vo2_estimate,
)

from Schemas.profile_metrics import (
    BatchMetricsPayload,
    MetricKey,
)

from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/profile", tags=["profile-metrics"])


# ====== METRICS – BATCH INSERT ======


@router.post("/metrics/{user_id}")
def insert_metrics(
    user_id: int,
    payload: BatchMetricsPayload,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    POST /profile/metrics/:user_id
    """
    try:
        return service_insert_metrics(
            user_id=user_id,
            payload=payload,
            user_jwt=user_jwt,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ====== METRICS – HISTORY (jedna metrika) ======


@router.get("/metrics/history/{user_id}")
def get_metric_history(
    user_id: int,
    metric: MetricKey = Query(..., description="metric key, e.g. weight_kg"),
    user_uid: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date/datetime"),
    date_to: Optional[str] = Query(None, description="ISO date/datetime"),
    limit: Optional[int] = Query(None, ge=1, le=5000),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        return service_get_metric_history(
            user_id=user_id,
            metric=metric,
            user_uid=user_uid,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            user_jwt=user_jwt,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ====== METRICS – LATEST (viac metrík + BMI v BE) ======


@router.get("/metrics/latest/{user_id}")
def get_latest_metrics(
    user_id: int,
    user_uid: Optional[str] = Query(None),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    GET /profile/metrics/latest/:user_id
    """
    try:
        return service_get_latest_metrics(
            user_id=user_id,
            user_uid=user_uid,
            user_jwt=user_jwt,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ====== VO2 – kompat ======


@router.get("/vo2-history/{user_id}")
def get_vo2_history(
    user_id: int,
    user_uid: Optional[str] = Query(None),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        return service_get_vo2_history(
            user_id=user_id,
            user_uid=user_uid,
            user_jwt=user_jwt,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vo2-estimate/{user_id}")
def get_vo2_estimate(
    user_id: int,
    user_uid: Optional[str] = Query(None),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    try:
        return service_get_vo2_estimate(
            user_id=user_id,
            user_uid=user_uid,
            user_jwt=user_jwt,
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))