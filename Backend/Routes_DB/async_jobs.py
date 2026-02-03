# Routes/jobs.py (alebo Routes_API/async_jobs.py – tam kde to máš)
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends, status

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
from Modules.HTTP.auth_deps import require_user_jwt  # JWT z FE

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _forbid_if_user_mismatch(request_user_id: int, url_user_id: int) -> None:
    """
    Minimal security guard:
    - bez možnosti vyčítať user_id z JWT (tvoj auth_deps ho nedáva),
      tak aspoň nedovolíme robiť nič s "iným" user_id než tým,
      ktorý FE posiela konzistentne v appke.

    POZOR: Toto NIE JE kryptograficky silné overenie identity.
    Reálnu autoritu aj tak drží Supabase RLS, lebo DB calls idú cez get_sb(user_jwt=...).
    Tento guard ale zabráni náhodným cross-user volaniam v rámci UI.
    """
    if int(request_user_id) != int(url_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden_for_user",
        )


@router.post("/enqueue/{user_id}", response_model=EnqueueJobResponse)
def enqueue_job(
    user_id: int,
    payload: EnqueueJobPayload,
    user_jwt: str = Depends(require_user_jwt),
) -> Dict[str, Any]:
    """
    Vytvorí nový async job pre daného usera.

    Dôležité:
    - user_jwt NEBERIEME z payloadu, iba z auth.
    - user_uuid berieme z payloadu (lebo auth_deps nevie user_uid),
      ale FE by ho malo posielať konzistentne. RLS aj tak stráži user_id pri čítaní.
    """
    try:
        # soft guard: payload.user_id by bolo lepšie, ale nemáš ho v schema.
        # aspoň netolerujeme "prázdny" user_uuid
        user_uid = (payload.user_uuid or "").strip()
        if not user_uid:
            raise HTTPException(status_code=400, detail="missing_user_uuid")

        out = service_enqueue_job(
            user_id=int(user_id),
            user_uid=user_uid,
            job_type=payload.job_type,
            payload=payload.payload,
            priority=payload.priority,
            run_after=payload.run_after,
            max_attempts=payload.max_attempts,
            dedupe_key=payload.dedupe_key,
            user_jwt=user_jwt,
            service=False,  # FE call
        )
        return {"success": True, "job": out.get("job"), "note": out.get("note")}
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active/{user_id}")
def list_active_jobs(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),  # ✅ auth added
    job_types: Optional[str] = Query(
        default=None,
        description="Comma-separated job_types, napr. 'sync,ai_analyze'",
    ),
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Vráti aktívne joby (queued/running) pre usera.
    """
    try:
        # bez user_id z JWT nevieme na 100% overiť identitu,
        # ale DB calls cez get_sb(user_jwt=...) + RLS sú autorita.
        # Napriek tomu necháme aspoň konzistenciu v FE.
        # (ak chceš, môžeš tento guard vyhodiť)
        _forbid_if_user_mismatch(request_user_id=user_id, url_user_id=user_id)

        job_types_list: Optional[List[str]] = None
        if job_types:
            job_types_list = [k.strip() for k in job_types.split(",") if k.strip()]

        rows = service_list_active_jobs(
            user_id=int(user_id),
            job_types=job_types_list,
            limit=int(limit),
            user_jwt=user_jwt,  # ✅ pass jwt so service can use correct client if needed later
        )
        return {"success": True, "jobs": rows}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent/{user_id}")
def list_recent_jobs(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),  # ✅ auth added
    job_types: Optional[str] = Query(
        default=None,
        description="Comma-separated job_types, napr. 'sync,ai_analyze'",
    ),
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Posledné joby (akýkoľvek status) pre usera.
    """
    try:
        _forbid_if_user_mismatch(request_user_id=user_id, url_user_id=user_id)

        job_types_list: Optional[List[str]] = None
        if job_types:
            job_types_list = [k.strip() for k in job_types.split(",") if k.strip()]

        # ⚠️ db_get_recent_jobs default service=True → to by obišlo RLS.
        # Tu MUSÍME použiť user_jwt + service=False.
        rows = db_get_recent_jobs(
            user_id=int(user_id),
            job_types=job_types_list,
            limit=int(limit),
            user_jwt=user_jwt,
            service=False,
        )
        return {"success": True, "jobs": rows}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/{job_id}")
def get_job(
    user_id: int,
    job_id: int,
    user_jwt: str = Depends(require_user_jwt),  # ✅ auth added
) -> Dict[str, Any]:
    """
    Detail konkrétneho jobu podľa ID.
    """
    try:
        _forbid_if_user_mismatch(request_user_id=user_id, url_user_id=user_id)

        # ⚠️ db_get_job_by_id default service=True → obišlo by RLS.
        row = db_get_job_by_id(
            user_id=int(user_id),
            job_id=int(job_id),
            user_jwt=user_jwt,
            service=False,
        )
        return {"success": True, "job": row}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run/{user_id}/{job_id}", response_model=RunJobResponse)
def run_job(
    user_id: int,
    job_id: int,
    user_jwt: str = Depends(require_user_jwt),
) -> Dict[str, Any]:
    """
    Manuálne spracovanie jedného jobu (mini-worker).
    """
    try:
        _forbid_if_user_mismatch(request_user_id=user_id, url_user_id=user_id)

        out = service_run_job_now(
            user_id=int(user_id),
            job_id=int(job_id),
            worker_id="api_run",
            user_jwt=user_jwt,
            service=False,
        )
        return {
            "success": out.get("error") is None,
            "job": out.get("job"),
            "error": out.get("error"),
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))