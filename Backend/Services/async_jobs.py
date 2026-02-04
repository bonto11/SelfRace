from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Set, cast

from Configs.config import COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
from Routes_DB.async_jobs import (
    db_insert_job,
    db_update_job_finished,
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


# ---------------- CONFIG ----------------

ALLOWED_JOB_TYPES: Set[str] = {
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
    "activity_review",
    "sync",
}

SENSITIVE_KEYS = {
    "user_jwt", "jwt", "authorization",
    "access_token", "refresh_token",
    "api_key", "openai_api_key",
}

# ---------------- HELPERS ----------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _as_dict(x: Any) -> Dict[str, Any]:
    return x if isinstance(x, dict) else {}

def _scrub_dict(x: Any) -> Any:
    if isinstance(x, dict):
        return {
            k: _scrub_dict(v)
            for k, v in x.items()
            if str(k).lower() not in SENSITIVE_KEYS
        }
    if isinstance(x, list):
        return [_scrub_dict(v) for v in x]
    return x


# ---------------- ENQUEUE (FAST) ----------------

def service_enqueue_job(
    user_id: int,
    user_uid: str,
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
    🔹 Jediné čo robí: INSERT do DB.
    🔹 Nevykonáva job.
    🔹 Okamžite vracia FE.
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")

    clean_payload = dict(payload or {})
    if jwt:
        clean_payload["user_jwt"] = jwt

    row = {
        "user_id": int(user_id),
        "user_uid": user_uid,
        "job_type": job_type,
        "status": "queued",
        "priority": int(priority),
        "dedupe_key": dedupe_key,
        "run_after": run_after,
        "input": clean_payload,
        "attempts": 0,
        "max_attempts": int(max_attempts),
        "progress": 0,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }

    created = db_insert_job(row, service=True)
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


# ---------------- EXECUTE (WORKER ONLY) ----------------

def service_execute_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """
    ⚠️ Volá IBA background worker.
    Job je už 'running'.
    """
    job_id = int(job["id"])
    user_id = int(job["user_id"])
    job_type = str(job["job_type"])
    payload = _as_dict(job.get("input"))
    jwt = payload.get("user_jwt")

    try:
        if job_type == "ai_analyze":
            result = service_analyze_athlete(
                user_id=user_id,
                user_jwt=jwt,
                service=jwt is None,
                model=payload.get("model"),
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
                activity_ids=payload.get("activity_ids", []),
                days_window=int(payload.get("days_window", 1)),
                score_threshold=float(payload.get("score_threshold", 0.55)),
                user_jwt=jwt,
                service=jwt is None,
            )

            # follow-up
            service_enqueue_job(
                user_id=user_id,
                user_uid=job["user_uid"],
                job_type="daily_extend",
                payload={"min_horizon_days": COACH_PLAN_GENERATE_MIN_HORIZON_DAYS},
                dedupe_key=f"daily_extend:{user_id}",
                priority=80,
                user_jwt=jwt,
                service=jwt is None,
            )

        elif job_type == "daily_extend":
            result = service_auto_extend_daily_plan(
                user_id=user_id,
                user_jwt=jwt,
                min_horizon_days=int(payload.get("min_horizon_days", COACH_PLAN_GENERATE_MIN_HORIZON_DAYS)),
            )

        elif job_type == "activity_review":
            result = service_activity_review(
                user_id=user_id,
                activity_id=int(payload["activity_id"]),
                user_jwt=jwt,
                service=jwt is None,
                model=payload.get("model"),
            )

        else:
            raise ValueError(f"Unsupported job_type: {job_type}")

        db_update_job_finished(
            job_id=job_id,
            status="succeeded",
            result=_scrub_dict(result),
            progress=100,
            service=True,
        )
        return {"ok": True}

    except Exception as e:
        db_update_job_finished(
            job_id=job_id,
            status="failed",
            error=str(e),
            progress=100,
            service=True,
        )
        return {"ok": False, "error": str(e)}