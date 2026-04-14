# Services/async_jobs.py
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Set, cast, List

from Configs.config import COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
from DB.async_jobs import (
    db_insert_job,
    db_update_job_finished,
    db_get_active_jobs,
    db_get_job_by_id,
    db_mark_job_running,
    db_find_active_job_by_dedupe,
)

from Services.AI.athlete_state.main import service_analyze_athlete
from Services.AI.weekly_plan.main import service_generate_weekly_plan
from Services.AI.daily_plan.main import (
    service_generate_daily_week,
    service_auto_extend_daily_plan,
)
from Services.plan_activity_match import auto_map_plans_for_activities
from Services.AI.activity_review.main import service_activity_review
from Modules.Supabase.auth import AuthCtx

# service-mode DB access / Strava sync / coach autoadjust
from Modules.Supabase.client import get_service_client
from Services.synchronization_single import service_sync_single_activity
from Services.coach_plan_adjustment import service_coach_autoadjust_after_update

supabase = get_service_client()

# ============================================================
# JOB TYPES
# ============================================================

ALLOWED_JOB_TYPES: Set[str] = {
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
    "activity_review",
    "sync",  # bulk sync/import
    "strava_sync_activity",  # sync single + enqueue followups (review only)
    "mark_activity_deleted",  # only marks deleted_at
    "coach_autoadjust",  # debounced per user
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

def _enqueue_autoadjust_debounced(
    ctx: AuthCtx, *, user_id: int, delay_sec: int = 120, force_reason: Optional[str] = None
) -> None:
    run_after = (
        datetime.now(timezone.utc) + timedelta(seconds=int(delay_sec))
    ).isoformat()
    
    payload = {}
    if force_reason:
        payload["force_reason"] = force_reason 

    service_enqueue_job(
        user_id=int(user_id),
        job_type="coach_autoadjust",
        payload=payload,
        priority=180,
        dedupe_key=f"coach_autoadjust:{user_id}",
        run_after=run_after,
        ctx=ctx,
    )
    
def _enqueue_activity_review_best_effort(
    ctx: AuthCtx, *, user_id: int, activity_id: int
) -> None:
    try:
        service_enqueue_job(
            user_id=int(user_id),
            job_type="activity_review",
            payload={
                "activity_id": int(activity_id),
                "model": None,
                "source": "auto",
                "comment": None,       
                "service": True,
                "save_to_db": True,
            },
            priority=150,
            dedupe_key=f"activity_review:{user_id}:{activity_id}",
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print(
            "[ACTIVITY-REVIEW][enqueue] failed",
            "user_id=", user_id,
            "activity_id=", activity_id,
            "err=", repr(e),
        )

# ============================================================
# ENQUEUE (FAST)
# ============================================================

def service_enqueue_job(
    user_id: int,
    *,
    job_type: str,
    payload: Dict[str, Any],
    priority: int = 100,
    dedupe_key: Optional[str] = None,
    run_after: Optional[str] = None,
    max_attempts: int = 3,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")

    if dedupe_key:
        existing = db_find_active_job_by_dedupe(
            user_id=int(user_id),
            dedupe_key=str(dedupe_key),
            ctx=ctx,
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

    try:
        created = db_insert_job(ctx=ctx, row=row)
    except Exception as e:
        return {"job": None, "note": f"insert_failed: {repr(e)}"}

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
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:

    rows = (
        db_get_active_jobs(
            user_id=int(user_id),
            job_types=job_types,
            limit=int(limit or 50),
            ctx=ctx,
        )
        or []
    )
    out: List[Dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        j = dict(r)
        j["input"] = _scrub_dict(j.get("input"))
        j["result"] = _scrub_dict(j.get("result"))
        out.append(j)
    return out


# ============================================================
# EXECUTE (WORKER)
# ============================================================

def service_execute_job(ctx: AuthCtx, job: Dict[str, Any]) -> Dict[str, Any]:
    job_id = int(job["id"])
    user_id = int(job["user_id"])
    job_type = str(job["job_type"])
    payload = _as_dict(job.get("input"))

    try:
        if job_type == "ai_analyze":
            result = service_analyze_athlete(
                user_id=user_id,
                ctx=ctx,
                model=payload.get("model"),
            )

        elif job_type == "weekly_generate":
            result = service_generate_weekly_plan(
                user_id=user_id,
                ctx=ctx,
                overwrite=bool(payload.get("overwrite", True)),
                state_id=payload.get("state_id"),
                weeks=payload.get("weeks"),
                model=payload.get("model"),
                reason=payload.get("reason"),
            )

        elif job_type == "daily_generate":
            result = service_generate_daily_week(
                user_id=user_id,
                ctx=ctx,
                week_index=int(payload["week_index"]),
                model=payload.get("model"),
                drop_past_days=bool(payload.get("drop_past_days", False)),
                reason=payload.get("reason"), # <--- ZMENA: PRIDANÉ
            )

        elif job_type == "plan_match":
            result = auto_map_plans_for_activities(
                user_id=user_id,
                activity_ids=cast(list, payload.get("activity_ids", [])),
                days_window=int(payload.get("days_window", 1)),
                score_threshold=float(payload.get("score_threshold", 0.55)),
                ctx=ctx,
            )
            service_enqueue_job(
                user_id=user_id,
                job_type="daily_extend",
                payload={"min_horizon_days": COACH_PLAN_GENERATE_MIN_HORIZON_DAYS},
                dedupe_key=f"daily_extend:{user_id}",
                priority=80,
                ctx=ctx,
            )

        elif job_type == "daily_extend":
            result = service_auto_extend_daily_plan(
                user_id=user_id,
                ctx=ctx,
                min_horizon_days=int(
                    payload.get("min_horizon_days", COACH_PLAN_GENERATE_MIN_HORIZON_DAYS)
                ),
            )

        elif job_type == "activity_review":
            result = service_activity_review(
                user_id=user_id,
                activity_id=int(payload["activity_id"]),
                ctx=ctx,
                model=payload.get("model"),
                source=payload.get("source"),
                comment=payload.get("comment"),
            )

            source = payload.get("source")
            
            if source == "user":
                print(f"[WORKER] Manual review detected for user {user_id}. Enqueuing autoadjust.")
                _enqueue_autoadjust_debounced(
                    ctx=ctx,
                    user_id=user_id,
                    delay_sec=5,
                    force_reason="manual_review" 
                )

        elif job_type == "sync":
            from Services.synchronization_bulk import import_activities_bulk
            result = import_activities_bulk(
                user_id=user_id,
                ctx=ctx,
                trigger=str(payload.get("trigger") or "async_worker"),
            )

        # -------------------------------
        # STRAVA PIPELINE
        # -------------------------------
        elif job_type == "strava_sync_activity":
            activity_id = int(payload.get("activity_id") or 0)
            if not activity_id:
                raise ValueError("missing activity_id")

            fetch_details = bool(payload.get("fetch_details", True))

            # 1) DATA IMPORT
            result = service_sync_single_activity(
                user_id=int(user_id),
                strava_activity_id=int(activity_id),
                fetch_details=fetch_details,
                ctx=ctx,
            )
            
            # 2) OPTIONAL hooks (plan match)
            if bool(payload.get("enqueue_plan_match", False)):
                try:
                    service_enqueue_job(
                        ctx=ctx,
                        user_id=int(user_id),
                        job_type="plan_match",
                        payload={
                            "activity_ids": [int(activity_id)],
                            "days_window": int(payload.get("plan_match_days_window", 2)),
                            "score_threshold": float(payload.get("plan_match_score_threshold", 0.55)),
                        },
                        priority=120,
                        dedupe_key=f"plan_match:{user_id}:{activity_id}",
                    )
                except Exception as e:  # noqa: BLE001
                    print("[PLAN-MATCH][enqueue] failed", repr(e))

        elif job_type == "coach_autoadjust":
            force_reason = payload.get("force_reason")
            result = service_coach_autoadjust_after_update(
                user_id=int(user_id),
                ctx=ctx,
                force_reason=force_reason 
            )

        elif job_type == "mark_activity_deleted":
            activity_id = int(payload.get("activity_id") or 0)
            if not activity_id:
                raise ValueError("missing activity_id")

            deleted_at = payload.get("deleted_at") or _now_iso()
            supabase.table("activities_summary").update({"deleted_at": deleted_at}).eq(
                "user_id", int(user_id)
            ).eq("activity_id", int(activity_id)).execute()

            result = {"ok": True, "deleted_at": deleted_at}

        else:
            raise ValueError(f"Unsupported job_type: {job_type}")

        db_update_job_finished(
            job_id=job_id,
            status="succeeded",
            result=cast(Optional[Dict[str, Any]], _scrub_dict(result)),
            error=None,
            progress=100,
            ctx=ctx,
        )
        return {"ok": True}

    except Exception as e:  # noqa: BLE001
        db_update_job_finished(
            job_id=job_id,
            status="failed",
            result=None,
            error=str(e),
            progress=100,
            ctx=ctx,
        )
        return {"ok": False, "error": str(e)}


def service_run_job_now(
    user_id: int,
    job_id: int,
    *,
    worker_id: str = "api_run",
    ctx: AuthCtx,
) -> Dict[str, Any]:

    job = db_get_job_by_id(ctx=ctx, user_id=int(user_id), job_id=int(job_id))
    if not job:
        return {"job": None, "error": "job_not_found"}

    status = str(job.get("status") or "")
    if status not in ("queued", "running"):
        return {"job": job, "error": f"job_not_runnable (status={status})"}

    try:
        attempts_old = int(job.get("attempts") or 0)
    except Exception:
        attempts_old = 0

    if status == "queued":
        locked = db_mark_job_running(
            job_id=int(job_id),
            worker_id=worker_id,
            attempts=attempts_old + 1,
            ctx=ctx,
        )
        if not locked:
            latest = db_get_job_by_id(user_id=int(user_id), job_id=int(job_id), ctx=ctx)
            return {"job": latest, "error": "job_not_queued_or_already_running"}
        job = locked

    out = service_execute_job(ctx=ctx,job=job)
    latest = db_get_job_by_id(user_id=int(user_id), job_id=int(job_id), ctx=ctx)
    return {"job": latest, "error": out.get("error")}