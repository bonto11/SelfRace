# Services/AI/weekly_plan.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from uuid import uuid4

from Services.AI.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)

from Services.AI.weekly_plan_builders import (
    build_weekly_context_from_db,
    extract_weeks_payload,
    build_weekly_rows_from_ai,
)

from Routes_AI.weekly_plan_generate import generate_weekly_plan_json

from Routes_DB.coach_plan_weekly import (
    db_insert_weekly_rows,
    db_clear_weekly_for_user_plan,
    db_get_latest_plan_id_for_user,
    db_get_weekly_for_user_plan,
)
from Routes_DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
    db_archive_user_plans,
    db_get_latest_plan_meta_for_user,
)

from Services.users import require_jwt


def _safe_error_payload(code: str, message: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {"code": code, "message": message}
    if isinstance(extra, dict):
        out.update(extra)
    return out


def _normalize_weekly_error(err: Any) -> Optional[Dict[str, Any]]:
    """
    Normalize weekly_plan["error"] to a stable dict:
      - None -> None
      - str  -> {code:"ai_failed", message:...}
      - dict -> keep (ensure code/message exist)
    """
    if err is None:
        return None
    if isinstance(err, str):
        return {"code": "ai_failed", "message": err}
    if isinstance(err, dict):
        code = err.get("code") or "ai_failed"
        msg = err.get("message") or err.get("detail") or "AI failed"
        out = dict(err)
        out["code"] = code
        out["message"] = msg
        return out
    return {"code": "ai_failed", "message": str(err)}


def service_generate_weekly_plan(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavná service pre weekly plán.

    Aktuálne: vraciame aj weekly_plan + trace + usage (na FE tuning).
    Neskôr to môžeš stripnúť pred odoslaním do FE.
    """
    # --- auth ---
    jwt = None if service else require_jwt(user_jwt)

    # --- quota (len user-trigger) ---
    if not service and is_user_over_token_quota(
        user_id,
        user_jwt=jwt,
        service=service,
    ):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "plan_id": None,
            "state_id": None,
            "model": (model or "auto"),
            "overwrite": overwrite,
            "weeks": weeks,
            "error": _safe_error_payload(
                "ai_quota_exceeded",
                "Mesačný limit AI plánov bol vyčerpaný. Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj.",
                {"used_tokens_this_month": used},
            ),
        }

    # --- build context ---
    ctx = build_weekly_context_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
        overwrite=overwrite,
        state_id=state_id,
        weeks=weeks,
    )

    context_payload = ctx["context_payload"]
    state_bundle = ctx["state_bundle"]
    horizon_weeks = ctx["horizon_weeks"]
    used_state_id = state_bundle["state_id"]

    # --- AI call ---
    weekly_plan, trace = generate_weekly_plan_json(
        context_payload=context_payload,
        model=model,  # None => provider default
    )

    if not isinstance(weekly_plan, dict):
        weekly_plan = {}

    # TRACE: chceme vždy dict (kvôli FE tuning / billing)
    if not isinstance(trace, dict):
        trace = {}

    # preferuj model, ktorý AI vráti (ak vráti)
    model_used = str(weekly_plan.get("model") or model or "auto")

    # --- billing (best effort) ---
    usage = extract_usage_from_trace(trace)
    billing_result: Optional[Dict[str, Any]] = None
    if usage:
        usage["model"] = model_used
        try:
            billing_result = log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.generate_weekly_plan",
                source="service" if service else "user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "state_id": used_state_id,
                    "requested_weeks": weeks,
                    "horizon_weeks": horizon_weeks,
                },
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] weekly_plan billing error:", repr(e))

    # --- plan_id ---
    plan_id = str(weekly_plan.get("plan_id") or uuid4())

    # --- overwrite: archive + clear previous weekly rows ---
    deleted_rows = 0
    archived_meta = 0
    if overwrite:
        archived_meta = db_archive_user_plans(
            user_id,
            user_jwt=jwt,
            service=service,
        )

        latest_plan_id = db_get_latest_plan_id_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        )
        if latest_plan_id:
            deleted_rows = db_clear_weekly_for_user_plan(
                user_id=user_id,
                plan_id=latest_plan_id,
                user_jwt=jwt,
                service=service,
            )

    # --- store weekly rows ---
    weeks_list = extract_weeks_payload(weekly_plan)
    rows: List[Dict[str, Any]] = build_weekly_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id,
        weeks_list=weeks_list,
    )

    inserted_rows = db_insert_weekly_rows(
        rows,
        user_jwt=jwt,
        service=service,
    )

    # --- plan_meta row (DB) ---
    plan_meta_dict = (weekly_plan.get("plan_meta") if isinstance(weekly_plan, dict) else {}) or {}
    if not isinstance(plan_meta_dict, dict):
        plan_meta_dict = {}

    start_date: Optional[str] = plan_meta_dict.get("start_date") or None
    end_date: Optional[str] = plan_meta_dict.get("end_date") or None

    if not start_date and weeks_list:
        start_date = weeks_list[0].get("week_start") or None
    if not end_date and weeks_list:
        last_week = weeks_list[-1]
        end_date = last_week.get("week_end") or last_week.get("week_start") or None

    main_sport = plan_meta_dict.get("main_sport")
    goal_kind = plan_meta_dict.get("goal_kind")

    meta_row = db_insert_plan_meta_generated(
        user_id=user_id,
        user_jwt=jwt,
        plan_id=plan_id,
        base_state_id=used_state_id if isinstance(used_state_id, int) else None,
        weeks_total=len(weeks_list) or horizon_weeks,
        start_date=start_date,
        end_date=end_date,
        main_sport=main_sport,
        goal_kind=goal_kind,
        source="ai_weekly_v1",
        service=service,
    )

    # --- RESPONSE ---
    error_norm = _normalize_weekly_error(weekly_plan.get("error"))

    resp: Dict[str, Any] = {
        "plan_id": plan_id,
        "state_id": used_state_id,
        "model": model_used,
        "overwrite": overwrite,
        "weeks": horizon_weeks,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "archived_meta": archived_meta,
        "error": error_norm,
    }
    if meta_row is not None:
        resp["plan_meta"] = meta_row

    # dočasne vraciame všetko (na FE ladenie)
    resp["weekly_plan"] = weekly_plan
    resp["debug_trace"] = trace
    resp["ai_usage"] = usage
    resp["billing"] = billing_result

    return resp


def service_get_latest_weekly_plan(
    user_id: int,
    *,
    user_jwt: str,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší weekly plán pre daného usera (vrátane listu týždňov).
    Čisto RLS/FE.
    """
    jwt = require_jwt(user_jwt)

    meta = db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
        service=False,
    )
    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    if not plan_id:
        plan_id = db_get_latest_plan_id_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=False,
        )
        if not plan_id:
            return None

    rows = db_get_weekly_for_user_plan(
        user_id=user_id,
        plan_id=plan_id,
        user_jwt=jwt,
        service=False,
    )
    if not rows:
        return None

    weeks_out: List[Dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: int(x.get("week_index") or 0)):
        weeks_out.append(
            {
                "week_index": int(r.get("week_index") or 0),
                "week_start": r.get("week_start"),
                "week_end": r.get("week_end"),
                "goal": r.get("goal"),
                "focus": r.get("focus"),
                "load_phase": r.get("load_phase"),
                "planned_km": r.get("planned_km"),
                "planned_minutes": r.get("planned_minutes"),
                "completed_km": r.get("completed_km"),
                "completed_minutes": r.get("completed_minutes"),
                "notes": r.get("notes"),
            }
        )

    return {
        "plan_id": plan_id,
        "weeks": weeks_out,
    }