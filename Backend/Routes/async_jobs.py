from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends, Request, BackgroundTasks

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
from DB.async_jobs import (
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
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    DÔLEŽITÉ: tento endpoint už NEČAKÁ na dokončenie jobu synchrónne.

    Predtým bežal celý job (napr. bulk sync stoviek/tisícok aktivít vrátane
    enrichmentu) v rámci jedného HTTP requestu - pri dlhších behoch (1000+
    aktivít) to prekračovalo proxy/gateway timeout, spojenie sa prerušilo
    skôr než server stihol poslať response headers, a prehliadač to nahlásil
    ako zavádzajúcu "CORS blocked" chybu (v skutočnosti šlo o prerušené
    spojenie, nie o CORS problém) - job pritom na serveri bežal ďalej.

    Teraz sa job spustí na pozadí (BackgroundTasks) a request sa vráti
    okamžite. FE zisťuje finálny výsledok výhradne cez polling
    /jobs/status/{user_id}/{job_id}, nie z odpovede tohto endpointu.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        job = db_get_job_by_id(user_id=user_id, job_id=job_id, ctx=ctx)
        if not job:
            return {"success": False, "job": None, "error": "job_not_found"}

        status = str(job.get("status") or "")
        if status not in ("queued", "running"):
            return {"success": False, "job": job, "error": f"job_not_runnable (status={status})"}

        def _run_in_background(uid: int, jid: int) -> None:
            try:
                service_run_job_now(
                    user_id=uid,
                    job_id=jid,
                    worker_id="api_run_bg",
                    ctx=ctx,
                )
            except Exception as e:  # noqa: BLE001
                print(f"[JOBS] background run failed user_id={uid} job_id={jid}: {e}")

        background_tasks.add_task(_run_in_background, user_id, job_id)

        return {
            "success": True,
            "job": job,
            "error": None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{user_id}/{job_id}")
def get_job_status(req: Request, user_id: int, job_id: int):
    """
    Vráti aktuálny stav asynchrónneho jobu. Toto je teraz jediný spôsob,
    ako FE zistí finálny výsledok dlho bežiaceho jobu (viď /run endpoint).
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        
        job = db_get_job_by_id(ctx=ctx, user_id=user_id, job_id=job_id)
        if not job:
            return {"success": False, "error_code": "NOT_FOUND", "message": "Job not found"}
        
        from Services.async_jobs import _scrub_dict
        clean_job = _scrub_dict(job)
        
        return {"success": True, "job": clean_job}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))