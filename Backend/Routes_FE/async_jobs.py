from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

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

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/enqueue/{user_id}", response_model=EnqueueJobResponse)
def enqueue_job(
    user_id: int,
    payload: EnqueueJobPayload,
) -> Dict[str, Any]:
    """
    Vytvorí nový async job pre daného usera.

    FE posiela:
      - job_type (napr. 'ai_analyze')
      - payload (ľubovoľný JSON – tu môže byť aj user_jwt)
      - voliteľne: dedupe_key, run_after, max_attempts
    """
    try:
        out = service_enqueue_job(
            user_id=user_id,
            user_uid=payload.user_uuid,
            job_type=payload.job_type,
            payload=payload.payload,
            priority=payload.priority,
            run_after=payload.run_after,
            max_attempts=payload.max_attempts,
            dedupe_key=payload.dedupe_key,
        )
        return {"success": True, "job": out.get("job"), "note": out.get("note")}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active/{user_id}")
def list_active_jobs(
    user_id: int,
    job_types: Optional[str] = Query(
        default=None,
        description="Comma-separated job_types, napr. 'sync,ai_analyze'",
    ),
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Vráti aktívne joby (status queued/running) pre daného usera.
    """
    try:
        job_types_list: Optional[List[str]] = None
        if job_types:
            job_types_list = [k.strip() for k in job_types.split(",") if k.strip()]

        rows = service_list_active_jobs(
            user_id=user_id,
            job_types=job_types_list,
            limit=limit,
        )
        return {"success": True, "jobs": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail:str(e))


@router.get("/recent/{user_id}")
def list_recent_jobs(
    user_id: int,
    job_types: Optional[str] = Query(
        default=None,
        description="Comma-separated job_types, napr. 'sync,ai_analyze'",
    ),
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Posledné joby (akýkoľvek status) pre daného usera.
    """
    try:
        job_types_list: Optional[List[str]] = None
        if job_types:
            job_types_list = [k.strip() for k in job_types.split(",") if k.strip()]

        rows = db_get_recent_jobs(user_id=user_id, job_types=job_types_list, limit=limit)
        return {"success": True, "jobs": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail:str(e))


@router.get("/{user_id}/{job_id}")
def get_job(
    user_id: int,
    job_id: int,
) -> Dict[str, Any]:
    """
    Detail konkrétneho jobu podľa ID.
    """
    try:
        row = db_get_job_by_id(user_id=user_id, job_id=job_id)
        return {"success": True, "job": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail:str(e))


@router.post("/run/{user_id}/{job_id}", response_model=RunJobResponse)
def run_job(
    user_id: int,
    job_id: int,
) -> Dict[str, Any]:
    """
    Manuálne spracovanie jedného jobu (mini-worker).
    """
    try:
        out = service_run_job_now(
            user_id=user_id,
            job_id=job_id,
            worker_id="api_run",
        )
        return {
            "success": out.get("error") is None,
            "job": out.get("job"),
            "error": out.get("error"),
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail:str(e))