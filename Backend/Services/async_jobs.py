from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Set, cast

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

from Services.AI.activity_review import service_review_activity  # activity_review

from Services.users import require_jwt


# typy jobov, ktoré worker vie spracovať
ALLOWED_JOB_TYPES: Set[str] = {
    "sync",
    "uspert_enrichment_zones",
    "ai_analyze",
    "activity_review",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
}

# kľúče, ktoré nikdy nechceme posielať FE
SENSITIVE_KEYS: Set[str] = {
    "user_jwt",
    "jwt",
    "authorization",
    "bearer",
    "access_token",
    "refresh_token",
    "id_token",
    "api_key",
    "openai_api_key",
    "secret",
    "cookie",
    "set-cookie",
    "headers",
    "session",
}

# debug/traces, ktoré môžu obsahovať citlivé dáta alebo prompt
SENSITIVE_DEBUG_KEYS: Set[str] = {
    "debug_trace",
    "trace",
    "raw",
    "cleaned",
    "raw_preview",
    "prompt",
    "system_txt",
    "user_txt",
    "weekly_plan",
    "messages",
    "response_format",
}

# keys, ktoré nechceme vracať FE z result payloadu (aj keby neboli “secret”)
NOISY_RESULT_KEYS: Set[str] = {
    "input",      # CoachAnalyzeInput a pod. – zbytočné pre FE
    "ai_usage",   # nechaj, ak chceš zobrazovať usage v UI
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(x: Any) -> Dict[str, Any]:
    """Zaručí dict pre typovanie (Pylance)."""
    return x if isinstance(x, dict) else {}


def _scrub_dict(x: Any) -> Any:
    """
    Rekurzívne odstráni citlivé/debug kľúče zo slovníkov aj nested štruktúr.
    """
    if isinstance(x, dict):
        out: Dict[str, Any] = {}
        for k, v in x.items():
            lk = str(k).lower()
            if lk in SENSITIVE_KEYS or lk in SENSITIVE_DEBUG_KEYS:
                continue
            out[k] = _scrub_dict(v)
        return out
    if isinstance(x, list):
        return [_scrub_dict(v) for v in x]
    return x


def _minify_external_events_for_client(external_events: Any) -> Any:
    """
    FE nepotrebuje celé okno + interné polia.
    Nechaj len to, čo UI reálne zobrazuje: events[].
    """
    if not isinstance(external_events, dict):
        return external_events
    evs = external_events.get("events")
    if isinstance(evs, list):
        return {"events": evs, "schema_version": external_events.get("schema_version")}
    return {"schema_version": external_events.get("schema_version"), "events": []}


def _minify_result_for_client(job_type: str, result: Any) -> Any:
    """
    Zredukuje result na to, čo FE reálne potrebuje.
    """
    if not isinstance(result, dict):
        return result

    # AI ANALYZE – posielaj len to, čo UI potrebuje
    if job_type == "ai_analyze":
        analysis = result.get("analysis")
        out: Dict[str, Any] = {
            "state_id": result.get("state_id"),
            "model": result.get("model"),
            "analysis": analysis,
            "compare_previous": result.get("compare_previous"),
            "error": result.get("error"),
        }
        return out

    # ACTIVITY REVIEW – FE môže chcieť len meta + review summary (alebo rovno celé review)
    if job_type == "activity_review":
        review = result.get("review") if isinstance(result.get("review"), dict) else result.get("ai_review")
        return {
            "ok": result.get("ok", True),
            "activity_id": result.get("activity_id"),
            "model": result.get("model"),
            "review": review,
            "error": result.get("error"),
        }

    # WEEKLY GENERATE – FE nepotrebuje celý weekly_plan JSON
    if job_type == "weekly_generate":
        return {
            "plan_id": result.get("plan_id"),
            "state_id": result.get("state_id"),
            "model": result.get("model"),
            "overwrite": result.get("overwrite"),
            "weeks": result.get("weeks"),
            "plan_meta": result.get("plan_meta"),
            "inserted_rows": result.get("inserted_rows"),
            "deleted_rows": result.get("deleted_rows"),
            "archived_meta": result.get("archived_meta"),
            "error": result.get("error"),
        }

    # DAILY GENERATE – FE potrebuje len výstup plánu a meta, nie kontext/prompt/debug
    if job_type == "daily_generate":
        daily_plan = result.get("daily_plan")
        return {
            "plan_id": result.get("plan_id"),
            "week_index": result.get("week_index"),
            "week_start": result.get("week_start"),
            "week_end": result.get("week_end"),
            "model": result.get("model"),
            "overwrite": result.get("overwrite"),
            "inserted_rows": result.get("inserted_rows"),
            "deleted_rows": result.get("deleted_rows"),
            "daily_plan": daily_plan,
            "error": result.get("error"),
        }

    if job_type == "sync":
        return {
            "ok": result.get("ok"),
            "plan": result.get("plan"),
            "stats": result.get("stats"),
            "range": result.get("range"),
            "error": result.get("error"),
        }

    # ostatné typy – defaultne nechaj, ale vyhoď noisy keys
    out2 = dict(result)
    for k in list(out2.keys()):
        if str(k).lower() in NOISY_RESULT_KEYS:
            out2.pop(k, None)

    # špeciálne: ak má result external_events a nechceš ho celý posielať FE
    if "external_events" in out2:
        out2["external_events"] = _minify_external_events_for_client(out2.get("external_events"))

    return out2


def _sanitize_job_for_client(job: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Sanitizes job dict before returning it to FE.
    Never removes server-needed data in DB, only in response.
    """
    if not isinstance(job, dict):
        return job

    j = dict(job)
    job_type = str(j.get("job_type") or "")

    # input: vyhoď JWT + tokeny
    inp = j.get("input")
    if isinstance(inp, dict):
        j["input"] = cast(Dict[str, Any], _scrub_dict(inp))
    else:
        j["input"] = {}

    # result: najprv zredukuj, potom scrubni
    res = j.get("result")
    res_min = _minify_result_for_client(job_type, res)
    j["result"] = _scrub_dict(res_min)

    return j


def service_enqueue_job(
    user_id: int,
    user_uid: str,
    *,
    job_type: str,
    payload: Dict[str, Any],
    priority: int = 100,  # ponechané v signature (UI), ale nezapisujeme do DB kým nemáš stĺpec
    run_after: Optional[str] = None,
    max_attempts: int = 3,
    dedupe_key: Optional[str] = None,  # ponechané v signature, ale nezapisujeme do DB kým nemáš stĺpec
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vytvorí nový job v async_jobs.

    Pozor: DB vrstva používa service klient.
    JWT dávame len do job.input (nie do DB auth).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")

    clean_payload: Dict[str, Any] = dict(payload or {})
    if jwt is not None:
        clean_payload.setdefault("user_jwt", jwt)

    # (Optional) meta do inputu – aby si videl v job.input čo sa chcelo
    # a neskôr to vieš migrovať do DB stĺpcov.
    if dedupe_key:
        clean_payload.setdefault("_dedupe_key", str(dedupe_key))
    if priority is not None:
        clean_payload.setdefault("_priority", int(priority))

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "user_uid": user_uid or "00000000-0000-0000-0000-000000000000",
        "job_type": job_type,
        "status": "queued",
        "input": clean_payload,
        "attempts": 0,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
    }

    if run_after:
        row["run_after"] = run_after

    created = db_insert_job(row)
    if not created:
        return {"job": None, "note": "enqueue_failed"}

    return {"job": _sanitize_job_for_client(created), "note": "enqueued"}


def service_list_active_jobs(
    user_id: int,
    job_types: Optional[List[str]] = None,
    limit: int = 50,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Jednoduchý wrapper pre FE – aktívne joby.
    """
    rows = db_get_active_jobs(user_id=user_id, job_types=job_types, limit=limit) or []
    sanitized: List[Dict[str, Any]] = []

    for r in rows:
        if not isinstance(r, dict):
            continue
        clean = _sanitize_job_for_client(r)
        if isinstance(clean, dict):
            sanitized.append(clean)

    return sanitized


def service_run_job_now(
    user_id: int,
    job_id: int,
    *,
    worker_id: str = "manual",
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Spustí konkrétny job (id) pre daného usera – mini worker.
    """
    # FE/RLS check (worker/cron to môže volať so service=True a bez jwt)
    if not service:
        _ = require_jwt(user_jwt)

    job = db_get_job_by_id(user_id=user_id, job_id=job_id)
    if not job:
        return {"job": None, "error": "job_not_found"}

    if int(job.get("user_id") or 0) != int(user_id):
        return {"job": _sanitize_job_for_client(job), "error": "forbidden_for_user"}

    status = str(job.get("status") or "")
    if status not in ("queued", "running"):
        return {"job": _sanitize_job_for_client(job), "error": f"job_not_runnable (status={status})"}

    try:
        attempts = int(job.get("attempts") or 0)
    except Exception:
        attempts = 0

    locked = db_mark_job_running(job_id=job_id, worker_id=worker_id, attempts=attempts + 1)
    if not locked:
        job_latest = db_get_job_by_id(user_id=user_id, job_id=job_id)
        return {"job": _sanitize_job_for_client(job_latest), "error": "job_not_queued_or_already_running"}

    job_type = str(job.get("job_type") or "")
    input_payload = _as_dict(job.get("input"))
    payload_jwt: Optional[str] = input_payload.get("user_jwt")

    result_payload: Optional[Dict[str, Any]] = None

    try:
        if job_type == "ai_analyze":
            run_as_service = bool(input_payload.get("service", False))

            if not run_as_service and payload_jwt is None:
                raise ValueError("ai_analyze: job.input.user_jwt is required unless service=True")

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
                debug=bool(input_payload.get("debug", True)),
            )

        elif job_type == "plan_match":
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
            days_window = int(days_window_raw) if days_window_raw is not None else 1

            score_threshold_raw = input_payload.get("score_threshold")
            score_threshold = float(score_threshold_raw) if score_threshold_raw is not None else 0.55

            if payload_jwt is None:
                result_payload = auto_map_plans_for_activities(
                    user_id=user_id,
                    activity_ids=activity_ids,
                    days_window=days_window,
                    score_threshold=score_threshold,
                    user_jwt=None,
                    service=True,
                )
            else:
                result_payload = auto_map_plans_for_activities(
                    user_id=user_id,
                    activity_ids=activity_ids,
                    days_window=days_window,
                    score_threshold=score_threshold,
                    user_jwt=payload_jwt,
                    service=False,
                )

            # enqueue follow-up daily_extend
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

        elif job_type == "daily_extend":
            if payload_jwt is None:
                raise ValueError("daily_extend: job.input.user_jwt is required")

            min_horizon_raw = input_payload.get("min_horizon_days")
            min_horizon_days = (
                int(min_horizon_raw) if min_horizon_raw is not None else COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
            )

            result_payload = service_auto_extend_daily_plan(
                user_id=user_id,
                user_jwt=payload_jwt,
                min_horizon_days=min_horizon_days,
            )

        elif job_type == "activity_review":
            activity_id = input_payload.get("activity_id")
            if activity_id is None:
                raise ValueError("activity_review: activity_id is required in job.input")

            # webhook bude posielať service=True (a bez user_jwt)
            run_as_service = bool(input_payload.get("service", True))

            if not run_as_service and payload_jwt is None:
                raise ValueError("activity_review: job.input.user_jwt is required unless service=True")

            result_payload = service_review_activity(
                user_id=user_id,
                activity_id=int(activity_id),
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                debug=bool(input_payload.get("debug", False)),
                save_to_db=True,
                model=input_payload.get("model"),
            )

        elif job_type == "sync":
            if payload_jwt is None:
                raise ValueError("sync: job.input.user_jwt is required")

            trigger = str(input_payload.get("trigger") or "manual")

            from Services.synchronization_bulk import import_activities_bulk

            result_payload = import_activities_bulk(
                user_id=user_id,
                user_jwt=payload_jwt,
                trigger=trigger,
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
        return {"job": _sanitize_job_for_client(finished), "error": None}

    except Exception as e:  # noqa: BLE001
        finished = db_update_job_finished(
            job_id=job_id,
            status="failed",
            result=None,
            error=str(e),
            progress=100,
        )
        return {"job": _sanitize_job_for_client(finished), "error": str(e)}


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
    """
    payload: Dict[str, Any] = {
        "save_to_db": bool(save_to_db),
        "debug": bool(debug),
        "service": True,
    }
    if model:
        payload["model"] = model

    return service_enqueue_job(
        user_id=user_id,
        user_uid=user_uid,
        job_type="ai_analyze",
        payload=payload,
        user_jwt=None,
        service=True,
    )