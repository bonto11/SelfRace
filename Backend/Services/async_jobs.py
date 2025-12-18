# backend/Services/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from backend.Routes_DB.async_jobs import (
    db_enqueue_job,
    db_get_active_jobs,
    db_claim_next_job,
    db_update_job_progress,
    db_finish_job_success,
    db_finish_job_error,
)

ALLOWED_KINDS = {
    "sync",
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
}


def _safe_kind(v: str) -> str:
    k = (v or "").strip()
    if not k:
        return "other"
    return k


def service_enqueue_job(
    user_id: int,
    *,
    user_uid: str,
    job_type: str,
    payload: Dict[str, Any],
    run_after: Optional[str] = None,
    max_attempts: int = 3,
    dedupe_key: Optional[str] = None,
) -> Dict[str, Any]:
    kind = _safe_kind(job_type)
    if kind not in ALLOWED_KINDS:
        raise ValueError(f"Unsupported job_type/kind: {kind}")

    # soft dedupe (bez DB unikát indexu):
    # ak existuje queued/running job rovnakého kind a rovnaký input.dedupe_key -> vráť ho
    if dedupe_key:
        actives = db_get_active_jobs(user_id=user_id, kinds=[kind], limit=100)
        for j in actives:
            inp = j.get("input") or {}
            if str(inp.get("dedupe_key") or "") == str(dedupe_key):
                return {"job": j, "note": "deduped_existing_active_job"}

    job_input = payload or {}
    if dedupe_key:
        job_input = {**job_input, "dedupe_key": dedupe_key}

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "user_uid": user_uid,
        "kind": kind,
        "status": "queued",
        "input": job_input,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
        "attempts": 0,
    }
    if run_after:
        row["run_after"] = run_after

    created = db_enqueue_job(row)
    if not created:
        return {"job": None, "note": "enqueue_failed"}

    return {"job": created, "note": "enqueued"}


def service_worker_claim(
    *,
    worker_id: str,
    kinds: Optional[List[str]] = None,
    limit_scan: int = 25,
) -> Optional[Dict[str, Any]]:
    # validácia kinds
    if kinds:
        for k in kinds:
            if k not in ALLOWED_KINDS:
                raise ValueError(f"Unsupported kind in claim: {k}")
    return db_claim_next_job(kinds=kinds, worker_id=worker_id, limit_scan=limit_scan)


def service_worker_progress(
    *,
    worker_id: str,
    job_id: str,
    progress: int,
) -> Optional[Dict[str, Any]]:
    return db_update_job_progress(
        job_id=job_id,
        progress=int(progress),
        locked_by=worker_id,
    )


def service_worker_finish(
    *,
    worker_id: str,
    job: Dict[str, Any],
    ok: bool,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    job_id = str(job.get("id") or "")
    if not job_id:
        return None

    if ok:
        return db_finish_job_success(job_id=job_id, result=result or {}, locked_by=worker_id)

    # fail / retry
    attempts = int(job.get("attempts") or 0)
    max_attempts = int(job.get("max_attempts") or 3)
    msg = error or "Job failed"

    return db_finish_job_error(
        job_id=job_id,
        error=msg,
        locked_by=worker_id,
        attempts=attempts,
        max_attempts=max_attempts,
    )