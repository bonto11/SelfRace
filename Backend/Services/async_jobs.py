# backend/Services/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from uuid import UUID

from Routes_DB.async_jobs import (
    db_insert_job,
    db_get_active_jobs,
    db_get_job_by_id,
    db_mark_job_running,
    db_update_job_finished,
)

from Services.coach_athlete_state import service_analyze_athlete

ALLOWED_JOB_KINDS = {
    "sync",
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
}


def _safe_kind(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return "other"
    return v


def service_enqueue_job(
    user_id: int,
    user_uid: UUID,
    *,
    kind: str,
    input: Dict[str, Any],
    run_after: Optional[str] = None,
    max_attempts: int = 3,
) -> Dict[str, Any]:
    """
    Vytvorí nový job v async_jobs.
    """
    job_kind = _safe_kind(kind)

    if job_kind not in ALLOWED_JOB_KINDS:
        raise ValueError(f"Unsupported job kind: {job_kind}")

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "user_uid": str(user_uid),
        "kind": job_kind,
        "status": "queued",
        "input": input or {},
        "attempts": 0,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
    }

    if run_after:
        row["run_after"] = run_after

    created = db_insert_job(row)
    if not created:
        return {"job": None, "note": "enqueue_failed"}

    return {"job": created, "note": "enqueued"}


def service_list_active_jobs(
    user_id: int,
    kinds: Optional[List[str]] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Jednoduchý wrapper pre FE/worker – aktívne joby.
    """
    return db_get_active_jobs(user_id=user_id, kinds=kinds, limit=limit)


def service_run_job_now(
    user_id: int,
    job_id: int,
    *,
    worker_id: str = "manual",
) -> Dict[str, Any]:
    """
    Spustí konkrétny job (id) pre daného usera.

    Toto je "mini worker" – vhodné na prvé testovanie:
      1) FE enqueue job (kind=ai_analyze)
      2) FE zavolá /jobs/run/{user_id}/{job_id}
      3) job sa spracuje, výsledok ide do async_jobs.result
    """
    job = db_get_job_by_id(user_id=user_id, job_id=job_id)
    if not job:
        return {"job": None, "error": "job_not_found"}

    if int(job.get("user_id") or 0) != int(user_id):
        # teoreticky by sa nemalo stať, len ochrana
        return {"job": job, "error": "forbidden_for_user"}

    status = str(job.get("status") or "")
    if status not in ("queued", "running"):
        return {
            "job": job,
            "error": f"job_not_runnable (status={status})",
        }

    attempts_raw = job.get("attempts")
    try:
        attempts = int(attempts_raw or 0)
    except Exception:
        attempts = 0

    # označ ako running (len ak bol queued)
    locked = db_mark_job_running(
        job_id=job_id,
        worker_id=worker_id,
        attempts=attempts + 1,
    )
    if not locked:
        # niekto iný ho možno zobral, alebo už nie je queued
        job_latest = db_get_job_by_id(user_id=user_id, job_id=job_id)
        return {
            "job": job_latest,
            "error": "job_not_queued_or_already_running",
        }

    kind = str(job.get("kind") or "")
    result_payload: Optional[Dict[str, Any]] = None

    try:
        # sem budeme postupne dopĺňať ďalšie druhy jobov
        if kind == "ai_analyze":
            # 1) beží tvoja existujúca AI logika
            result_payload = service_analyze_athlete(user_id=user_id)

        else:
            raise ValueError(f"Unsupported job kind for worker: {kind}")

        finished = db_update_job_finished(
            job_id=job_id,
            status="succeeded",
            result=result_payload,
            error=None,
            progress=100,
        )
        return {"job": finished, "error": None}

    except Exception as e:  # noqa: BLE001
        finished = db_update_job_finished(
            job_id=job_id,
            status="failed",
            result=None,
            error=str(e),
            progress=100,
        )
        return {"job": finished, "error": str(e)}