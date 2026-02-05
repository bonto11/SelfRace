from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set, cast, List

from Configs.config import COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
from Routes_DB.async_jobs import (
    db_insert_job,
    db_update_job_finished,
    db_get_active_jobs,
    db_get_job_by_id,
    db_mark_job_running,
    db_find_active_job_by_dedupe,
)

from Services.AI.athlete_state import service_analyze_athlete
from Services.AI.weekly_plan import service_generate_weekly_plan
from Services.AI.daily_plan import (
    service_generate_daily_week,
    service_auto_extend_daily_plan,
)
from Services.plan_activity_match import auto_map_plans_for_activities
from Services.AI.activity_review import service_activity_review
from Services.users import require_jwt


ALLOWED_JOB_TYPES: Set[str] = {
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
    "activity_review",
    "sync",
}

SENSITIVE_KEYS: Set[str] = {
    "user_jwt",
    "jwt",
    "authorization",
    "access_token",
    "refresh_token",
    "api_key",
    "openai_api_key",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(x: Any) -> Dict[str, Any]:
    return x if isinstance(x, dict) else {}


def _scrub_dict(x: Any) -> Any:
    if isinstance(x, dict):
        out: Dict[str, Any] = {}
        for k, v in x.items():
            if str(k).lower() in SENSITIVE_KEYS:
                continue
            out[k] = _scrub_dict(v)
        return out
    if isinstance(x, list):
        return [_scrub_dict(v) for v in x]
    return x


# ---------------- ENQUEUE (FAST) ----------------

def service_enqueue_job(
    user_id: int,
    *,
    job_type: str,
    payload: Dict[str, Any],
    priority: int = 100,
    dedupe_key: Optional[str] = None,
    run_after: Optional[str] = None,
    max_attempts: int = 3,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    🔹 Robí len INSERT (a voliteľne dedupe lookup).
    🔹 Okamžite vracia FE.
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")

    if dedupe_key:
        existing = db_find_active_job_by_dedupe(
            user_id=int(user_id),
            dedupe_key=str(dedupe_key),
            user_jwt=None,
            service=True,
        )
        if existing:
            return {
                "job": {
                    "id": existing.get("id"),
                    "job_type": existing.get("job_type"),
                    "status": existing.get("status"),
                },
                "note": "deduped",
            }

    clean_payload = dict(payload or {})
    if jwt:
        clean_payload["user_jwt"] = jwt

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "job_type": job_type,
        "status": "queued",
        "priority": int(priority or 100),
        "dedupe_key": dedupe_key,
        "run_after": run_after,
        "input": clean_payload,
        "attempts": 0,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    created = db_insert_job(row, user_jwt=None, service=True)
    
    if not created:
        return {"job": None, "note": "enqueue_failed"}

    return {
        "job": {
            "id": created.get("id"),
            "job_type": created.get("job_type"),
            "status": created.get("status"),
        },
        "note": "enqueued",
    }


def service_list_active_jobs(
    user_id: int,
    *,
    job_types: Optional[List[str]] = None,
    limit: int = 50,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    _ = require_jwt(user_jwt)
    rows = db_get_active_jobs(
        user_id=int(user_id),
        job_types=job_types,
        limit=int(limit or 50),
        user_jwt=user_jwt,
        service=False,
    ) or []
    out: List[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        # minimal scrub
        j = dict(r)
        j["input"] = _scrub_dict(j.get("input"))
        j["result"] = _scrub_dict(j.get("result"))
        out.append(j)
    return out


# ---------------- EXECUTE (WORKER) ----------------

def service_execute_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    ⚠️ Volá IBA background worker.
    Predpoklad: job je už 'running' (locknutý).
    """
    job_id = int(job["id"])
    user_id = int(job["user_id"])
    job_type = str(job["job_type"])
    payload = _as_dict(job.get("input"))

    jwt = payload.get("user_jwt")

    # job beží ako service LEN ak nemá jwt
    run_as_service = jwt is None

    try:
        if job_type == "ai_analyze":
            result = service_analyze_athlete(
                user_id=user_id,
                user_jwt=jwt,
                service=run_as_service,
                model=payload.get("model"),
                debug=bool(payload.get("debug", False)),
                save_to_db=bool(payload.get("save_to_db", True)),
            )

        elif job_type == "weekly_generate":
            result = service_generate_weekly_plan(
                user_id=user_id,
                user_jwt=jwt,
                overwrite=bool(payload.get("overwrite", True)),
                state_id=payload.get("state_id"),
                weeks=payload.get("weeks"),
                model=payload.get("model"),
            )

        elif job_type == "daily_generate":
            result = service_generate_daily_week(
                user_id=user_id,
                user_jwt=jwt,
                week_index=int(payload["week_index"]),
                plan_id=payload.get("plan_id"),
                overwrite=bool(payload.get("overwrite", True)),
                model=payload.get("model"),
            )

        elif job_type == "plan_match":
            result = auto_map_plans_for_activities(
                user_id=user_id,
                activity_ids=cast(list, payload.get("activity_ids", [])),
                days_window=int(payload.get("days_window", 1)),
                score_threshold=float(payload.get("score_threshold", 0.55)),
                user_jwt=jwt,
                service=run_as_service,
            )

            service_enqueue_job(
                user_id=user_id,
                job_type="daily_extend",
                payload={"min_horizon_days": COACH_PLAN_GENERATE_MIN_HORIZON_DAYS},
                dedupe_key=f"daily_extend:{user_id}",
                priority=80,
                user_jwt=jwt,
                service=run_as_service,
            )

        elif job_type == "daily_extend":
            result = service_auto_extend_daily_plan(
                user_id=user_id,
                service=run_as_service,
                min_horizon_days=int(
                    payload.get("min_horizon_days", COACH_PLAN_GENERATE_MIN_HORIZON_DAYS)
                ),
            )

        elif job_type == "activity_review":
            result = service_activity_review(
                user_id=user_id,
                activity_id=int(payload["activity_id"]),
                user_jwt=jwt,
                service=run_as_service,
                model=payload.get("model"),
            )

        elif job_type == "sync":
            from Services.synchronization_bulk import import_activities_bulk
            result = import_activities_bulk(
                user_id=user_id,
                user_jwt=jwt,
                trigger=str(payload.get("trigger") or "async_worker"),
            )

        else:
            raise ValueError(f"Unsupported job_type: {job_type}")

        db_update_job_finished(
            job_id=job_id,
            status="succeeded",
            result=cast(Optional[Dict[str, Any]], _scrub_dict(result)),
            error=None,
            progress=100,
            user_jwt=None,
            service=True,
        )
        return {"ok": True}

    except Exception as e:  # noqa: BLE001
        db_update_job_finished(
            job_id=job_id,
            status="failed",
            result=None,
            error=str(e),
            progress=100,
            user_jwt=None,
            service=True,
        )
        return {"ok": False, "error": str(e)}


def service_run_job_now(
    user_id: int,
    job_id: int,
    *,
    worker_id: str = "api_run",
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Debug/manual endpoint: zamkne job a vykoná ho inline (bude blokovať request).
    """
    _ = require_jwt(user_jwt)

    job = db_get_job_by_id(user_id=int(user_id), job_id=int(job_id), user_jwt=None, service=True)
    if not job:
        return {"job": None, "error": "job_not_found"}

    status = str(job.get("status") or "")
    if status not in ("queued", "running"):
        return {"job": job, "error": f"job_not_runnable (status={status})"}

    try:
        attempts_old = int(job.get("attempts") or 0)
    except Exception:
        attempts_old = 0

    # lock len keď je queued
    if status == "queued":
        locked = db_mark_job_running(
            job_id=int(job_id),
            worker_id=worker_id,
            attempts=attempts_old + 1,
            user_jwt=None,
            service=True,
        )
        if not locked:
            latest = db_get_job_by_id(user_id=int(user_id), job_id=int(job_id), user_jwt=None, service=True)
            return {"job": latest, "error": "job_not_queued_or_already_running"}
        job = locked

    out = service_execute_job(job)
    latest = db_get_job_by_id(user_id=int(user_id), job_id=int(job_id), user_jwt=None, service=True)
    return {"job": latest, "error": out.get("error")}