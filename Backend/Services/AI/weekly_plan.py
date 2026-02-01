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

# NOTE:
# weekly_plan_generate.py si upravíme tak, aby používal Services.AI.provider (openai/gemini).
# Zatiaľ iba prestávame spoliehať sa na DEFAULT_MODEL tu.
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


def service_generate_weekly_plan(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service pre weekly plán.

    Nový štýl:
      - model je voliteľný (keď None, provider/generator si vyberie default)
      - DEFAULT_MODEL už nepoužívame tu
      - resp["model"] preferuje model z AI výstupu, ak ho AI vráti

    SAFE pravidlá:
      - debug=False → nevraciame FE celý weekly_plan (len meta)
      - debug=True  → weekly_plan + trace
    """
    # --- auth ---
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

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

    # --- build context (LLM payload nemeníme) ---
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
    # model=None => generator/provider vyberie default podľa AI_PROVIDER
    weekly_plan, trace = generate_weekly_plan_json(
        context_payload=context_payload,
        model=model,          # ✅ pass-through (optional)
        debug_raw=debug,      # debug -> trace/raw preview
    )

    if not isinstance(weekly_plan, dict):
        weekly_plan = {}

    # preferuj model, ktorý AI vráti (ak vráti)
    model_used = str(weekly_plan.get("model") or model or "auto")

    # --- billing (usage v trace; pri gemini možno nebude v rovnakom formáte => usage None) ---
    usage = extract_usage_from_trace(trace) if trace else None
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

    # --- SAFE RESPONSE (default) ---
    error_obj = weekly_plan.get("error") if isinstance(weekly_plan, dict) else None
    resp: Dict[str, Any] = {
        "plan_id": plan_id,
        "state_id": used_state_id,
        "model": model_used,
        "overwrite": overwrite,
        "weeks": horizon_weeks,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "archived_meta": archived_meta,
        "error": error_obj,
    }
    if meta_row is not None:
        resp["plan_meta"] = meta_row

    # --- DEBUG (only when explicitly requested) ---
    if debug:
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

    weeks: List[Dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: int(x.get("week_index") or 0)):
        weeks.append(
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
                # "raw_json": r.get("raw_json"),
            }
        )

    return {
        "plan_id": plan_id,
        "weeks": weeks,
    }