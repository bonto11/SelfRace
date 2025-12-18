# backend/Services/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from uuid import UUID

from backend.Routes_DB.async_jobs import (
    db_insert_job,
    db_get_active_jobs,
)

# povolené druhy jobov – kľudne rozšíriš podľa potreby
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

    - nekontroluje dedupe/podobné joby (to vieme doplniť neskôr)
    - len validuje kind a spraví INSERT
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
        # typicky DB error – necháme to na 500 v routeri
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