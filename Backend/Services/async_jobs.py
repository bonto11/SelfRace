from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Set, cast, Tuple

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
)
from Services.plan_activity_match import auto_map_plans_for_activities  # plan_match
from Services.AI.activity_review import service_activity_review

from Services.users import require_jwt


# typy jobov, ktoré worker vie spracovať
ALLOWED_JOB_TYPES: Set[str] = {
    "sync",
    "uspert_enrichment_zones",
    "ai_analyze",
    "weekly_generate",
    "daily_generate",
    "daily_extend",
    "plan_match",
    "activity_review",
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
    "input",
    # "ai_usage",  # nechaj ak chceš zobrazovať usage; inak odkomentuj
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(x: Any) -> Dict[str, Any]:
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
    if not isinstance(external_events, dict):
        return external_events
    evs = external_events.get("events")
    if isinstance(evs, list):
        return {"schema_version": external_events.get("schema_version"), "events": evs}
    return {"schema_version": external_events.get("schema_version"), "events": []}


def _minify_result_for_client(job_type: str, result: Any) -> Any:
    """
    Zredukuje result na to, čo FE reálne potrebuje.
    Potom sa ešte scrubne cez _scrub_dict().
    """
    if not isinstance(result, dict):
        return result

    if job_type == "ai_analyze":
        analysis = result.get("analysis")
        return {
            "state_id": result.get("state_id"),
            "model": result.get("model"),
            "analysis": analysis,
            "compare_previous": result.get("compare_previous"),
            "error": result.get("error"),
        }

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

    if job_type == "daily_generate":
        return {
            "plan_id": result.get("plan_id"),
            "week_index": result.get("week_index"),
            "week_start": result.get("week_start"),
            "week_end": result.get("week_end"),
            "model": result.get("model"),
            "overwrite": result.get("overwrite"),
            "inserted_rows": result.get("inserted_rows"),
            "deleted_rows": result.get("deleted_rows"),
            "daily_plan": result.get("daily_plan"),
            "error": result.get("error"),
        }

    if job_type == "daily_extend":
        return {
            "changed": result.get("changed"),
            "reason": result.get("reason"),
            "generated_weeks": result.get("generated_weeks"),
            "final_days_left": result.get("final_days_left"),
            "last_daily_date": result.get("last_daily_date"),
            "plan_id": result.get("plan_id"),
            "error": result.get("error"),
        }

    if job_type == "plan_match":
        return {
            "ok": result.get("ok"),
            "mapped": result.get("mapped"),
            "unmapped": result.get("unmapped"),
            "stats": result.get("stats"),
            "daily_extend_job": result.get("daily_extend_job"),
            "daily_extend_job_error": result.get("daily_extend_job_error"),
            "error": result.get("error"),
        }

    if job_type == "sync":
        return {
            "ok": result.get("ok"),
            "stats": result.get("stats"),
            "range": result.get("range"),
            "error": result.get("error"),
        }

    if job_type == "activity_review":
        return {
            "activity_id": result.get("activity_id"),
            "model": result.get("model"),
            "summary": result.get("summary"),
            "highlights": result.get("highlights"),
            "recommendations": result.get("recommendations"),
            "review": result,  # ak chceš full review payload
            "error": result.get("error"),
        }

    # default: drop noisy keys
    out2 = dict(result)
    for k in list(out2.keys()):
        if str(k).lower() in NOISY_RESULT_KEYS:
            out2.pop(k, None)

    if "external_events" in out2:
        out2["external_events"] = _minify_external_events_for_client(out2.get("external_events"))

    return out2


def _sanitize_job_for_client(job: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(job, dict):
        return job

    j = dict(job)
    job_type = str(j.get("job_type") or "")

    inp = j.get("input")
    j["input"] = cast(Dict[str, Any], _scrub_dict(inp)) if isinstance(inp, dict) else {}

    res = j.get("result")
    res_min = _minify_result_for_client(job_type, res)
    j["result"] = _scrub_dict(res_min)

    return j


# -----------------------------------------------------------------------------
# Queue helpers (NO POLLING; event-driven chaining)
# -----------------------------------------------------------------------------

def _is_runnable_now(job: Dict[str, Any]) -> bool:
    """
    run_after: ak existuje a je v budúcnosti, job ešte nespúšťaj.
    """
    ra = job.get("run_after")
    if not ra:
        return True
    try:
        # očakávame ISO string
        dt = datetime.fromisoformat(str(ra).replace("Z", "+00:00"))
        return dt <= datetime.now(timezone.utc)
    except Exception:
        return True


def _pick_next_queued_job_for_user(
    user_id: int,
    *,
    limit: int = 50,
) -> Optional[Dict[str, Any]]:
    """
    Vyber najbližší queued job (FIFO-ish) pre usera.
    Používa db_get_active_jobs (už existuje) aby sme nemuseli pridávať nový DB call.
    """
    rows = db_get_active_jobs(user_id=user_id, job_types=None, limit=limit) or []
    queued: List[Dict[str, Any]] = []
    running_found = False

    for r in rows:
        if not isinstance(r, dict):
            continue
        status = str(r.get("status") or "")
        if status == "running":
            running_found = True
        if status == "queued" and _is_runnable_now(r):
            queued.append(r)

    if running_found:
        return None

    if not queued:
        return None

    def _sort_key(x: Dict[str, Any]) -> Tuple[int, str, int]:
        pr = x.get("priority")
        try:
            pr_i = int(pr) if pr is not None else 100
        except Exception:
            pr_i = 100
        ra = str(x.get("run_after") or "")
        ca = str(x.get("created_at") or "")
        # nižšia priority číslo = skôr (ak to tak používaš), ak nie, otoč
        return (pr_i, ra or ca, int(x.get("id") or 0))

    queued_sorted = sorted(queued, key=_sort_key)
    return queued_sorted[0]


def _try_kick_user_queue(
    user_id: int,
    *,
    worker_id: str,
    chain_limit: int,
) -> Optional[Dict[str, Any]]:
    """
    Ak nič nerunninguje, zober prvý queued job a odštartuj chain.
    """
    next_job = _pick_next_queued_job_for_user(user_id, limit=50)
    if not next_job:
        return None

    jid = next_job.get("id")
    try:
        jid_i = int(jid)
    except Exception:
        return None

    # spustí a chainne
    return service_run_job_now(
        user_id=user_id,
        job_id=jid_i,
        worker_id=worker_id,
        user_jwt=None,
        service=True,
        run_chain=True,
        chain_limit=chain_limit,
    ).get("job")


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------

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
    user_jwt: Optional[str] = None,
    service: bool = False,
    # ✅ new:
    auto_kick: bool = True,
    chain_limit: int = 10,
) -> Dict[str, Any]:
    """
    Vytvorí nový job v async_jobs.

    auto_kick=True:
      - keď pre usera nič nerunninguje, automaticky spustí prvý queued job
      - nevzniká polling; deje sa iba pri enqueue
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    if job_type not in ALLOWED_JOB_TYPES:
        raise ValueError(f"Unsupported job_type: {job_type}")

    clean_payload: Dict[str, Any] = dict(payload or {})
    if jwt is not None:
        clean_payload.setdefault("user_jwt", jwt)

    # allow job-defined service mode (worker will respect it)
    if service:
        clean_payload.setdefault("service", True)

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "user_uid": user_uid or "00000000-0000-0000-0000-000000000000",
        "job_type": job_type,
        "status": "queued",
        "input": clean_payload,
        "attempts": 0,
        "max_attempts": int(max_attempts or 3),
        "progress": 0,
        "priority": int(priority or 100),
    }

    if run_after:
        row["run_after"] = run_after
    if dedupe_key:
        row["dedupe_key"] = dedupe_key

    created = db_insert_job(row)
    if not created:
        return {"job": None, "note": "enqueue_failed"}

    kicked_job: Optional[Dict[str, Any]] = None
    if auto_kick:
        try:
            kicked_job = _try_kick_user_queue(
                user_id=int(user_id),
                worker_id="auto_enqueue",
                chain_limit=int(chain_limit or 10),
            )
        except Exception:
            kicked_job = None

    resp: Dict[str, Any] = {"job": _sanitize_job_for_client(created), "note": "enqueued"}
    if kicked_job is not None:
        resp["kicked"] = kicked_job
    return resp


def service_list_active_jobs(
    user_id: int,
    job_types: Optional[List[str]] = None,
    limit: int = 50,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    _ = require_jwt(user_jwt)
    rows = db_get_active_jobs(user_id=user_id, job_types=job_types, limit=limit) or []
    out: List[Dict[str, Any]] = []
    for r in rows:
        if isinstance(r, dict):
            s = _sanitize_job_for_client(r)
            if isinstance(s, dict):
                out.append(s)
    return out


def service_run_job_now(
    user_id: int,
    job_id: int,
    *,
    worker_id: str = "manual",
    user_jwt: Optional[str] = None,
    service: bool = False,
    # ✅ new:
    run_chain: bool = True,
    chain_limit: int = 10,
) -> Dict[str, Any]:
    """
    Spustí konkrétny job (id) pre daného usera – mini worker.
    Po dobehnutí (success/fail) môže automaticky spustiť ďalšie queued joby (chain).
    """
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
    job_error: Optional[str] = None
    final_row: Optional[Dict[str, Any]] = None

    try:
        # -------------------- DISPATCH --------------------
        if job_type == "ai_analyze":
            run_as_service = bool(input_payload.get("service", False))
            if not run_as_service and payload_jwt is None:
                raise ValueError("ai_analyze: job.input.user_jwt is required unless service=True")

            model_override = input_payload.get("model")
            debug = bool(input_payload.get("debug", False))
            save_to_db = bool(input_payload.get("save_to_db", True))

            result_payload = service_analyze_athlete(
                user_id=user_id,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                debug=debug,
                save_to_db=save_to_db,
                model=model_override,
            )

        elif job_type == "weekly_generate":
            if payload_jwt is None and not bool(input_payload.get("service", False)):
                raise ValueError("weekly_generate: job.input.user_jwt is required unless service=True")

            run_as_service = bool(input_payload.get("service", False))

            result_payload = service_generate_weekly_plan(
                user_id=user_id,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                overwrite=bool(input_payload.get("overwrite", True)),
                state_id=input_payload.get("state_id"),
                weeks=input_payload.get("weeks"),
                model=input_payload.get("model"),
            )

        elif job_type == "daily_generate":
            if payload_jwt is None and not bool(input_payload.get("service", False)):
                raise ValueError("daily_generate: job.input.user_jwt is required unless service=True")

            run_as_service = bool(input_payload.get("service", False))

            week_index = input_payload.get("week_index")
            if week_index is None:
                raise ValueError("daily_generate: week_index is required in job.input")

            result_payload = service_generate_daily_week(
                user_id=user_id,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                week_index=int(week_index),
                plan_id=input_payload.get("plan_id"),
                overwrite=bool(input_payload.get("overwrite", True)),
                model=input_payload.get("model"),
                debug=bool(input_payload.get("debug", False)),
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

            # plan_match môže ísť aj service=True (bez jwt)
            run_as_service = bool(input_payload.get("service", False)) or (payload_jwt is None)

            result_payload = auto_map_plans_for_activities(
                user_id=user_id,
                activity_ids=activity_ids,
                days_window=days_window,
                score_threshold=score_threshold,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
            )

            # enqueue follow-up daily_extend (nech ide do queue, nie inline)
            try:
                extend_job = service_enqueue_job(
                    user_id=user_id,
                    user_uid=str(job.get("user_uid") or ""),
                    job_type="daily_extend",
                    payload={"min_horizon_days": COACH_PLAN_GENERATE_MIN_HORIZON_DAYS},
                    user_jwt=payload_jwt,
                    service=(payload_jwt is None),
                    auto_kick=False,  # nech to spraví chain po skončení tohto jobu
                )
                if isinstance(result_payload, dict):
                    result_payload["daily_extend_job"] = extend_job.get("job")
            except Exception as e:
                if isinstance(result_payload, dict):
                    result_payload["daily_extend_job_error"] = str(e)

        elif job_type == "daily_extend":
            if payload_jwt is None and not bool(input_payload.get("service", False)):
                raise ValueError("daily_extend: job.input.user_jwt is required unless service=True")

            run_as_service = bool(input_payload.get("service", False))

            min_horizon_raw = input_payload.get("min_horizon_days")
            min_horizon_days = (
                int(min_horizon_raw) if min_horizon_raw is not None else COACH_PLAN_GENERATE_MIN_HORIZON_DAYS
            )

            result_payload = service_auto_extend_daily_plan(
                user_id=user_id,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                min_horizon_days=min_horizon_days,
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

        elif job_type == "activity_review":
            activity_id = input_payload.get("activity_id")
            if activity_id is None:
                raise ValueError("activity_review: activity_id is required in job.input")
            try:
                activity_id_i = int(activity_id)
            except Exception:
                raise ValueError("activity_review: activity_id must be int")

            run_as_service = bool(input_payload.get("service", False))
            if not run_as_service and payload_jwt is None:
                raise ValueError("activity_review: user_jwt is required unless service=True")

            result_payload = service_activity_review(
                user_id=user_id,
                activity_id=activity_id_i,
                user_jwt=None if run_as_service else payload_jwt,
                service=run_as_service,
                model=input_payload.get("model"),
            )

        else:
            raise ValueError(f"Unsupported job_type for worker: {job_type}")

        final_row = db_update_job_finished(
            job_id=job_id,
            status="succeeded",
            result=result_payload,
            error=None,
            progress=100,
        )

    except Exception as e:  # noqa: BLE001
        job_error = str(e)
        final_row = db_update_job_finished(
            job_id=job_id,
            status="failed",
            result=None,
            error=job_error,
            progress=100,
        )

    # -------------------- CHAIN (event-driven) --------------------
    # Spusti ďalšie queued joby pre usera, len ak:
    # - run_chain=True
    # - chain_limit > 0
    chained: List[Dict[str, Any]] = []
    if run_chain and int(chain_limit or 0) > 0:
        left = int(chain_limit)
        # už jeden job prebehol, takže chainuješ max (chain_limit - 1)
        left = max(0, left - 1)

        while left > 0:
            next_job = _pick_next_queued_job_for_user(user_id=int(user_id), limit=50)
            if not next_job:
                break

            nid = next_job.get("id")
            try:
                nid_i = int(nid)
            except Exception:
                break

            # rekurzia, ale kontrolovaná (run_chain=False aby sme nerobili nested while)
            r = service_run_job_now(
                user_id=int(user_id),
                job_id=nid_i,
                worker_id=worker_id,
                user_jwt=None,
                service=True,
                run_chain=False,
                chain_limit=0,
            )
            j = r.get("job")
            if isinstance(j, dict):
                chained.append(j)

            left -= 1

    resp: Dict[str, Any] = {"job": _sanitize_job_for_client(final_row), "error": job_error}
    if chained:
        resp["chained"] = chained
    return resp


def service_enqueue_ai_analyze_job_service(
    user_id: int,
    user_uid: str,
    *,
    model: Optional[str] = None,
    debug: bool = False,
    save_to_db: bool = True,
) -> Dict[str, Any]:
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
        auto_kick=True,
        chain_limit=10,
    )