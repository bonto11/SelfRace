from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends, Request

from Schemas.async_jobs import (
    EnqueueJobPayload,
    EnqueueJobResponse,
    RunJobResponse,
)
from Services.async_jobs import (
    service_enqueue_job,
    service_list_active_jobs,
    service_run_job_now,
)
from Routes_DB.async_jobs import (
    db_get_recent_jobs,
    db_get_job_by_id,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/enqueue/{user_id}", response_model=EnqueueJobResponse)
def enqueue_job(
    req: Request,
    user_id: int,
    payload: EnqueueJobPayload,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        out = service_enqueue_job(
            user_id=user_id,
            job_type=payload.job_type,
            payload=payload.payload,
            priority=payload.priority,
            run_after=payload.run_after,
            max_attempts=payload.max_attempts,
            dedupe_key=payload.dedupe_key,
            ctx=ctx,
        )

        if not out.get("job"):
            return {
                "success": False,
                "job": None,
                "note": out.get("note") or "enqueue_failed",
            }

        return {
            "success": True,
            "job": out["job"],
            "note": out.get("note"),
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active/{user_id}")
def list_active_jobs(
    req: Request,
    user_id: int,
    job_types: Optional[str] = Query(default=None),
    limit: int = 50,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        job_types_list: Optional[List[str]] = None
        if job_types:
            job_types_list = [k.strip() for k in job_types.split(",") if k.strip()]

        rows = service_list_active_jobs(
            user_id=user_id,
            job_types=job_types_list,
            limit=limit,
            ctx=ctx,
        )
        return {"success": True, "jobs": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent/{user_id}")
def list_recent_jobs(
    req: Request,
    user_id: int,
    job_types: Optional[str] = Query(default=None),
    limit: int = 20,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))

        job_types_list: Optional[List[str]] = None
        if job_types:
            job_types_list = [k.strip() for k in job_types.split(",") if k.strip()]

        rows = db_get_recent_jobs(
            user_id=user_id,
            job_types=job_types_list,
            limit=limit,
            ctx=ctx,
        )
        return {"success": True, "jobs": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/{job_id}")
def get_job(
    req: Request,
    user_id: int,
    job_id: int,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        
        row = db_get_job_by_id(user_id=user_id, job_id=job_id, ctx=ctx)
        return {"success": True, "job": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run/{user_id}/{job_id}", response_model=RunJobResponse)
def run_job(
    req: Request,
    user_id: int,
    job_id: int,
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        
        out = service_run_job_now(
            user_id=user_id,
            job_id=job_id,
            worker_id="api_run",
            ctx=ctx,
        )
        return {
            "success": out.get("error") is None,
            "job": out.get("job"),
            "error": out.get("error"),
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))