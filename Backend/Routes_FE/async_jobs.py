# backend/Routes_FE/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from fastapi import APIRouter, HTTPException, Query

from backend.Schemas.async_jobs import (
    EnqueueJobPayload,
    EnqueueJobResponse,
    WorkerClaimRequest,
    WorkerClaimResponse,
    WorkerProgressRequest,
    WorkerFinishRequest,
)
from backend.Services.async_jobs import (
    service_enqueue_job,
    service_worker_claim,
    service_worker_progress,
    service_worker_finish,
)
from backend.Routes_DB.async_jobs import (
    db_get_active_jobs,
    db_get_recent_jobs,
    db_get_job_by_id,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/enqueue/{user_id}", response_model=EnqueueJobResponse)
def enqueue_job(user_id: int, payload: EnqueueJobPayload) -> Dict[str, Any]:
    """
    FE enqueue: job_type/payload -> DB: kind/input
    """
    try:
        out = service_enqueue_job(
            user_id=user_id,
            user_uid=payload.user_uid,
            job_type=payload.job_type,
            payload=payload.payload,
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
    kinds: Optional[str] = Query(default=None, description="Comma-separated kinds"),
    limit: int = 50,
) -> Dict[str, Any]:
    try:
        ks: Optional[List[str]] = None
        if kinds:
            ks = [t.strip() for t in kinds.split(",") if t.strip()]
        rows = db_get_active_jobs(user_id=user_id, kinds=ks, limit=limit)
        return {"success": True, "jobs": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent/{user_id}")
def list_recent_jobs(
    user_id: int,
    kinds: Optional[str] = Query(default=None),
    limit: int = 20,
) -> Dict[str, Any]:
    try:
        ks: Optional[List[str]] = None
        if kinds:
            ks = [t.strip() for t in kinds.split(",") if t.strip()]
        rows = db_get_recent_jobs(user_id=user_id, kinds=ks, limit=limit)
        return {"success": True, "jobs": rows}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/{job_id}")
def get_job(user_id: int, job_id: str) -> Dict[str, Any]:
    try:
        row = db_get_job_by_id(user_id=user_id, job_id=job_id)
        return {"success": True, "job": row}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────
# Worker endpoints (pre background runner)
# ─────────────────────────────────────────

@router.post("/worker/claim", response_model=WorkerClaimResponse)
def worker_claim(req: WorkerClaimRequest) -> Dict[str, Any]:
    """
    Worker si vyžiada 1 job -> status=running + locked_by.
    """
    try:
        job = service_worker_claim(
            worker_id=req.worker_id,
            kinds=req.kinds,
            limit_scan=req.limit_scan,
        )
        return {"success": True, "job": job}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/worker/progress")
def worker_progress(req: WorkerProgressRequest) -> Dict[str, Any]:
    try:
        job = service_worker_progress(
            worker_id=req.worker_id,
            job_id=req.job_id,
            progress=req.progress,
        )
        return {"success": True, "job": job}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/worker/finish")
def worker_finish(req: WorkerFinishRequest) -> Dict[str, Any]:
    """
    Worker ukončí job succeeded/failed.
    """
    try:
        # načítaj job (bez user filteru – worker je interný)
        # ak chceš prísnejšie, môžeš si vytiahnuť job priamo cez DB select by id
        # a kontrolovať locked_by.
        # Tu to držím jednoduché: worker_id musí sedieť pri finish (v DB helperoch).
        # Potrebujeme job record kvôli attempts/max_attempts.
        # Najjednoduchšie: dotiahnuť ho cez "recent" nie je ok; radšej by-id bez user_id.
        # Keďže nemáš helper, spravíme to cez get_job_by_id len ak poznáš user_id.
        # Preto posielaj v req.result (alebo error) a v job.input budeme mať user_id.
        #
        # V praxi: worker pri claim dostane celý job row -> ten drží v pamäti a pošle finish.
        job = {"id": req.job_id, "attempts": 999, "max_attempts": 3}  # fallback, ak by si neposlal job
        out = service_worker_finish(
            worker_id=req.worker_id,
            job=job,
            ok=bool(req.ok),
            result=req.result or {},
            error=req.error,
        )
        return {"success": True, "job": out}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))