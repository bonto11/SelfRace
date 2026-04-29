from fastapi import APIRouter, HTTPException, Request

from Services.user_metrics import (
    service_get_vo2_measured_latest,
    service_get_vo2_measured_trend,
    service_get_vo2_estimated_latest,
    service_get_vo2_estimated_trend,
    service_get_body_fat_latest,
    service_get_body_fat_trend,
    service_get_generic_latest,
    service_get_generic_trend,
    service_save_metric,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/user-metrics", tags=["user-metrics"])


@router.get("/vo2-max/measured/latest")
def get_vo2_measured_latest(req: Request, user_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_vo2_measured_latest(user_id=user_id, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vo2-max/measured/trend")
def get_vo2_measured_trend(req: Request, user_id: int, days: int = 90):
    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_get_vo2_measured_trend(user_id=user_id, days=days, ctx=ctx)
        return {"success": True, "trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vo2-max/estimated/latest")
def get_vo2_estimated_latest(req: Request, user_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_vo2_estimated_latest(user_id=user_id, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vo2-max/estimated/trend")
def get_vo2_estimated_trend(req: Request, user_id: int, days: int = 90):
    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_get_vo2_estimated_trend(user_id=user_id, days=days, ctx=ctx)
        return {"success": True, "data": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/body-fat/latest")
def get_body_fat_latest(req: Request, user_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_body_fat_latest(user_id=user_id, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/body-fat/trend")
def get_body_fat_trend(req: Request, user_id: int, days: int = 90):
    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_get_body_fat_trend(user_id=user_id, days=days, ctx=ctx)
        return {"success": True, "trends": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 🌟 NOVÉ: Univerzálne GET routy pre akúkoľvek metriku (váha, tepy atď.)
@router.get("/latest/{user_id}")
def get_generic_latest(req: Request, user_id: int, metric: str):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_generic_latest(user_id=user_id, metric=metric, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trend/{user_id}")
def get_generic_trend(req: Request, user_id: int, metric: str, days: int = 90):
    try:
        ctx = require_user(get_auth_ctx(req))
        trends = service_get_generic_trend(user_id=user_id, metric=metric, days=days, ctx=ctx)
        return {"success": True, "data": trends}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/{metric}")
def save_single_metric(req: Request, user_id: int, metric: str, value: float):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_save_metric(user_id=user_id, metric=metric, value=value, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))