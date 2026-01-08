from __future__ import annotations

from typing import Any, Dict, Optional, List

from Configs.config import COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
from Routes_DB.async_jobs import (
    db_insert_job,
    db_get_active_jobs,
    db_get_job_by_id,
    db_mark_job_running,
    db_update_job_finished,
)

from Services.AI.athlete_state import service_analyze_athlete  # ai_analyze
from Services.AI.weekly_plan import service_generate_weekly_plan  # weekly_generate
from Services.AI.daily_plan import (
    service_generate_daily_week,
    service_auto_extend_daily_plan,
)  # daily_generate, daily_extend
from Services.plan_activity_match import auto_map_plans_for_activities  # plan_match

from Services.users import require_jwt


# typy jobov, ktoré worker vie spracovať
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
    dedupe_key: Optional[str] = None,
    user_jwt: Optional[str] = None,  # posielame z routera, ide len do payloadu
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vytvorí nový job v async_jobs.

    Pozor: DB vrstva (Routes_DB.async_jobs) používa service klient,
    nijaké user_jwt sa tam neposiela. JWT dávame len do job.input.
    """

    if service:
        jwt = user_jwt  # service klient – JWT nepotrebujeme
    else:
        jwt = require_jwt(user_jwt)

    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")

    # payload normalizuj a doplň user_jwt (ak je)
    clean_payload: Dict[str, Any] = dict(payload or {})
    if jwt is not None:
        # ak ho caller dal priamo do payloadu, necháme jeho hodnotu
        clean_payload.setdefault("user_jwt", jwt)

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "user_uid": user_uid or "00000000-0000-0000-0000-000000000000",
        "job_type": job_type,
        "status": "queued",
        "input": clean_payload,
        "attempts": 0,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
        # priority/dedupe_key zatiaľ v DB nemáme – kľudne pridáme neskôr
    }

    if run_after:
        row["run_after"] = run_after

    # DB vrstva beží na service role – sem user_jwt neposielame
    created = db_insert_job(row)
    if not created:
        return {"job": None, "note": "enqueue_failed"}

    return {"job": created, "note": "enqueued"}


def service_list_active_jobs(
    user_id: int,
    job_types: Optional[List[str]] = None,
    limit: int = 50,
    user_jwt: Optional[str] = None,  # zatiaľ nepoužívame, nechávame pre budúcnosť
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
    user_jwt: Optional[str] = None,  # JWT berieme z job.input, nie z tohto argumentu
    service: bool = False,
) -> Dict[str, Any]:
    """
    Spustí konkrétny job (id) pre daného usera – mini worker.

    - service=False  → typicky FE/manual (RLS, require_jwt na vstupe).
    - service=True   → cron/worker – tento JWT sa prakticky nepoužíva,
                       rozhodujúce je, čo je v job.input (user_jwt / service).
    """

    if service:
        jwt = user_jwt  # len kvôli prípadnej budúcnosti; teraz sa nepoužíva
    else:
        jwt = require_jwt(user_jwt)

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

    # jedna spoločná premenná – väčšina service_* teraz očakáva user_jwt
    payload_jwt: Optional[str] = input_payload.get("user_jwt")

    result_payload: Optional[Dict[str, Any]] = None

    try:
        # 1) ANALYZE ATHLETE
        if job_type == "ai_analyze":
            # nový prepínač – či bežíme v service móde (cron) alebo v RLS móde (FE)
            run_as_service = bool(input_payload.get("service", False))

            if not run_as_service and payload_jwt is None:
                raise ValueError(
                    "ai_analyze: job.input.user_jwt is required unless service=True"
                )

            debug_flag = bool(input_payload.get("debug", False))
            save_flag = bool(input_payload.get("save_to_db", True))
            model_override = input_payload.get("model")

            result_payload = service_analyze_athlete(
                user_id=user_id,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                debug=debug_flag,
                save_to_db=save_flag,
                model=model_override,
            )

        # 2) WEEKLY GENERATE
        elif job_type == "weekly_generate":
            if payload_jwt is None:
                raise ValueError("weekly_generate: job.input.user_jwt is required")

            result_payload = service_generate_weekly_plan(
                user_id=user_id,
                user_jwt=payload_jwt,
                overwrite=bool(input_payload.get("overwrite", True)),
                state_id=input_payload.get("state_id"),
                weeks=input_payload.get("weeks"),
                model=input_payload.get("model"),
                debug=bool(input_payload.get("debug", False)),
            )

        # 3) DAILY GENERATE (konkrétny týždeň)
        elif job_type == "daily_generate":
            if payload_jwt is None:
                raise ValueError("daily_generate: job.input.user_jwt is required")

            week_index = input_payload.get("week_index")
            if week_index is None:
                raise ValueError("daily_generate: week_index is required in job.input")

            result_payload = service_generate_daily_week(
                user_id=user_id,
                user_jwt=payload_jwt,
                week_index=int(week_index),
                plan_id=input_payload.get("plan_id"),
                overwrite=bool(input_payload.get("overwrite", True)),
                model=input_payload.get("model"),
                debug=bool(input_payload.get("debug", False)),
            )

        # 4) AUTO MAP (plan_match)
        elif job_type == "plan_match":
            # Tu už NEvyžadujeme user_jwt – ak nie je, bežíme v service režime.
            raw_ids = input_payload.get("activity_ids") or []
            if not isinstance(raw_ids, list):
                raise ValueError("plan_match: activity_ids must be a list")

            activity_ids: List[int] = []
            for v in raw_ids:
                try:
                    activity_ids.append(int(v))
                except Exception:
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

            # 4a) samotné matchovanie plán ↔️ aktivity
            if payload_jwt is None:
                # webhook / service režim – DB klient pôjde cez service role
                result_payload = auto_map_plans_for_activities(
                    user_id=user_id,
                    activity_ids=activity_ids,
                    days_window=days_window,
                    score_threshold=score_threshold,
                    user_jwt=None,
                    service=True,
                )
            else:
                # RLS režim – klasicky s JWT
                result_payload = auto_map_plans_for_activities(
                    user_id=user_id,
                    activity_ids=activity_ids,
                    days_window=days_window,
                    score_threshold=score_threshold,
                    user_jwt=payload_jwt,
                    service=False,
                )

            # 4b) enqueue follow-up job typu "daily_extend",
            # aby bol horizont aspoň COACH_PLAN_GENERATE_MIN_HORIZON_DAYS dní
            try:
                extend_job = service_enqueue_job(
                    user_id=user_id,
                    user_uid=str(job.get("user_uid") or ""),
                    job_type="daily_extend",
                    payload={"min_horizon_days": COACH_PLAN_GENERATE_MIN_HORIZON_DAYS},
                    user_jwt=payload_jwt,
                    service=(payload_jwt is None),
                )
                if isinstance(result_payload, dict):
                    result_payload["daily_extend_job"] = extend_job.get("job")
            except Exception as e:
                if isinstance(result_payload, dict):
                    result_payload["daily_extend_job_error"] = str(e)

        # 5) EXTEND DAILY
        elif job_type == "daily_extend":
            if payload_jwt is None:
                raise ValueError("daily_extend: job.input.user_jwt is required")

            min_horizon_raw = input_payload.get("min_horizon_days")
            if min_horizon_raw is None:
                min_horizon_days = COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
            else:
                min_horizon_days = int(min_horizon_raw)

            result_payload = service_auto_extend_daily_plan(
                user_id=user_id,
                user_jwt=payload_jwt,
                min_horizon_days=min_horizon_days,
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


# -------------------------------------------------
# Helper pre cron: enqueuj ai_analyze v service režime
# -------------------------------------------------


def service_enqueue_ai_analyze_job_service(
    user_id: int,
    user_uid: str,
    *,
    model: Optional[str] = None,
    debug: bool = False,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """
    Convenience helper pre cron/maintenance:

      - enqueuje job_type="ai_analyze"
      - job pobeží v SERVICE móde (bez user_jwt)
      - výsledok sa uloží do coach_athlete_state

    Použitie (napr. v cron route):
        service_enqueue_ai_analyze_job_service(
            user_id=123,
            user_uid="auth-uid-123",
        )
    """
    payload: Dict[str, Any] = {
        "save_to_db": bool(save_to_db),
        "debug": bool(debug),
        "service": True,  # ← kľúčové pre worker (run_as_service)
    }
    if model:
        payload["model"] = model

    return service_enqueue_job(
        user_id=user_id,
        user_uid=user_uid,
        job_type="ai_analyze",
        payload=payload,
        # cron/worker → service klient, JWT netreba
        user_jwt=None,
        service=True,
    )
