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
from Services.coach_plan_weekly import service_generate_weekly_plan
from Services.coach_plan_daily import service_generate_daily_week
from Services.plan_activity_match import auto_map_plans_for_activities
from Services.coach_plan_daily import service_auto_extend_daily_plan

ALLOWED_JOB_TYPES = {
    "sync",
    "uspert_enrichment_zones",
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
}


def service_enqueue_job(
    user_id: int,
    user_uid: str,
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

    # Tu by sa dal spraviť dedupe podľa dedupe_key, keď ho pridáme do tabuľky

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "user_uid": user_uid or "00000000-0000-0000-0000-000000000000",
        "job_type": job_type,
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
    job_types: Optional[List[str]] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Jednoduchý wrapper pre FE/worker – aktívne joby.
    """
    return db_get_active_jobs(user_id=user_id, job_types=job_types, limit=limit)

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

    job_type = str(job.get("job_type") or "")
    input_payload = job.get("input") or {}
    if not isinstance(input_payload, dict):
        input_payload = {}

    result_payload: Optional[Dict[str, Any]] = None

    try:
        # 1) ANALYZE ATHLETE
        if job_type == "ai_analyze":
            result_payload = service_analyze_athlete(
                user_id=user_id,
                # ak máš v signatúre tieto voľby, inak ich vyhoď
                # debug/input options berieme z job.input
                # ak tvoja service_analyze_athlete berie len user_id,
                # pokojne ich ignoruj
            )

        # 2) WEEKLY GENERATE
        elif job_type == "weekly_generate":
            result_payload = service_generate_weekly_plan(
                user_id=user_id,
                overwrite=bool(input_payload.get("overwrite", True)),
                state_id=input_payload.get("state_id"),
                weeks=input_payload.get("weeks"),
                model=input_payload.get("model"),
                debug=bool(input_payload.get("debug", False)),
            )

        # 3) DAILY GENERATE (konkrétny týždeň)
        elif job_type == "daily_generate":
            week_index = input_payload.get("week_index")
            if week_index is None:
                raise ValueError("daily_generate: week_index is required in job.input")

            result_payload = service_generate_daily_week(
                user_id=user_id,
                week_index=int(week_index),
                plan_id=input_payload.get("plan_id"),
                overwrite=bool(input_payload.get("overwrite", True)),
                model=input_payload.get("model"),
                debug=bool(input_payload.get("debug", False)),
            )
        
        # 4) AUTO MAP (plan_match)
        elif job_type == "plan_match":
            # očakávame, že job.input má tvar:
            # {
            #   "activity_ids": [12345, 23456],
            #   "days_window": 1,          # optional, default 1
            #   "score_threshold": 0.55    # optional, default 0.55
            # }

            raw_ids = input_payload.get("activity_ids") or []
            if not isinstance(raw_ids, list):
                raise ValueError("plan_match: activity_ids must be a list")

            activity_ids: List[int] = []
            for v in raw_ids:
                try:
                    activity_ids.append(int(v))
                except Exception:
                    # ak je nejaká blbosť v poli, len ju preskočíme
                    continue

            if not activity_ids:
                raise ValueError("plan_match: no valid activity_ids in job.input")

            days_window_raw = input_payload.get("days_window")
            if days_window_raw is None:
                days_window = 1
            else:
                days_window = int(days_window_raw)

            score_threshold_raw = input_payload.get("score_threshold")
            if score_threshold_raw is None:
                score_threshold = 0.55
            else:
                score_threshold = float(score_threshold_raw)

            result_payload = auto_map_plans_for_activities(
                user_id=user_id,
                activity_ids=activity_ids,
                days_window=days_window,
                score_threshold=score_threshold,
            )

        # 5) EXTEND DAILY
        elif job_type == "daily_extend":
            result_payload = service_auto_extend_daily_plan(
                user_id=user_id,
                min_horizon_days = 10,
            )

        else:
            raise ValueError(f"Unsupported job_type for worker: {job_type}")

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