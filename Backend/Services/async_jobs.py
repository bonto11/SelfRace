# backend/Services/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Routes_DB.async_jobs import (
    db_insert_job,
    db_get_active_jobs,
    db_get_job_by_id,
    db_mark_job_running,
    db_update_job_finished,
)

from Services.coach_athlete_state import service_analyze_athlete

ALLOWED_JOB_TYPES = {
    "sync",
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
}


def _safe_job_type(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return "other"
    return v


def service_enqueue_job(
    user_id: int,
    *,
    job_type: str,
    payload: Dict[str, Any],
    priority: int = 100,
    run_after: Optional[str] = None,
    max_attempts: int = 3,
    dedupe_key: Optional[str] = None,  # zatiaľ nevyužité – do budúcna
) -> Dict[str, Any]:
    """
    Vytvorí nový job v async_jobs.
    """
    jt = _safe_job_type(job_type)

    if jt not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {jt}")

    # Tu by sa dal spraviť dedupe podľa dedupe_key, keď ho pridáme do tabuľky

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        # TODO: keď budeš mať v BE k dispozícii Supabase UID, doplň ho sem
        "user_uid": "00000000-0000-0000-0000-000000000000",
        "kind": jt,  # mapujeme job_type -> DB stĺpec kind
        "status": "queued",
        "input": payload or {},
        "attempts": 0,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
        # priority/dedupe_key zatiaľ v DB nemáme – kľudne pridáme neskôr
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
    Spustí konkrétny job (id) pre daného usera – mini worker.
    """
    job = db_get_job_by_id(user_id=user_id, job_id=job_id)
    if not job:
        return {"job": None, "error": "job_not_found"}

    if int(job.get("user_id") or 0) != int(user_id):
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

    locked = db_mark_job_running(
        job_id=job_id,
        worker_id=worker_id,
        attempts=attempts + 1,
    )
    if not locked:
        job_latest = db_get_job_by_id(user_id=user_id, job_id=job_id)
        return {
            "job": job_latest,
            "error": "job_not_queued_or_already_running",
        }

    kind = str(job.get("kind") or "")
    result_payload: Optional[Dict[str, Any]] = None

    try:
        # sem postupne doplníme ďalšie druhy jobov
        if kind == "ai_analyze":
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