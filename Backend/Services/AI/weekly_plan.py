# Services/AI/weekly_plan.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from Services.AI.utils.billing import (
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
    db_get_weekly_for_user_plan,
)
from Routes_DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
    db_get_latest_plan_meta_for_user,
)

from Modules.Supabase.auth import AuthCtx


def _safe_error_payload(
    code: str, message: str, extra: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
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
    ctx: AuthCtx,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    override_start_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavná service pre weekly plán.

    Aktuálne: vraciame aj weekly_plan + trace + usage (na FE tuning).
    Neskôr to môžeš stripnúť pred odoslaním do FE.
    """

    # --- quota (len user-trigger) ---
    if is_user_over_token_quota(
        user_id,
        ctx=ctx,
    ):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
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
    context = build_weekly_context_from_db(
        user_id=user_id,
        ctx=ctx,
        state_id=state_id,
        weeks=weeks,
    )

    context_payload = context["context_payload"]
    state_bundle = context["state_bundle"]
    horizon_weeks = context["horizon_weeks"]
    used_state_id = state_bundle["state_id"]

    if override_start_date:
        if isinstance(context_payload.get("prefs"), dict):
            context_payload["prefs"]["plan_start_date"] = override_start_date
            context_payload["replan_trigger"] = "critical_injury_override"

    # --- AI call ---
    weekly_plan, trace = generate_weekly_plan_json(
        context_payload=context_payload,
        model=model,  
        ctx=ctx,
    )

    if not isinstance(weekly_plan, dict):
        weekly_plan = {}
    if not isinstance(trace, dict):
        trace = {}

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
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "state_id": used_state_id,
                    "requested_weeks": weeks,
                    "horizon_weeks": horizon_weeks,
                },
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] weekly_plan billing error:", repr(e))

    # --- overwrite: archive + clear previous weekly rows ---
    deleted_rows = 0
    if overwrite:
        deleted_rows = db_clear_weekly_for_user_plan(
            user_id=user_id,
            ctx=ctx,
        )

    # --- store weekly rows ---
    weeks_list = extract_weeks_payload(weekly_plan)
    rows: List[Dict[str, Any]] = build_weekly_rows_from_ai(
        user_id=user_id,
        weeks_list=weeks_list,
    )

    inserted_rows = db_insert_weekly_rows(
        rows,
        ctx=ctx,
    )

    # --- plan_meta row (DB) ---
    plan_meta_dict = (
        weekly_plan.get("plan_meta") if isinstance(weekly_plan, dict) else {}
    ) or {}
    if not isinstance(plan_meta_dict, dict):
        plan_meta_dict = {}

    start_date: Optional[str] = plan_meta_dict.get("start_date") or None
    end_date: Optional[str] = plan_meta_dict.get("end_date") or None

    if not start_date and weeks_list:
        start_date = weeks_list[0].get("week_start") or None
    if not end_date and weeks_list:
        last_week = weeks_list[-1]
        end_date = last_week.get("week_end") or last_week.get("week_start") or None

    meta_row = db_insert_plan_meta_generated(
        user_id=user_id,
        weeks_total=len(weeks_list) or horizon_weeks,
        start_date=start_date,
        end_date=end_date,
        ctx=ctx,
    )

    # --- RESPONSE ---
    error_norm = _normalize_weekly_error(weekly_plan.get("error"))

    resp: Dict[str, Any] = {
        "state_id": used_state_id,
        "model": model_used,
        "overwrite": True,
        "weeks": horizon_weeks,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "error": error_norm,
    }
    if meta_row is not None:
        resp["plan_meta"] = meta_row

    resp["weekly_plan"] = weekly_plan

    return resp


def service_get_latest_weekly_plan(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší weekly plán pre daného usera (vrátane listu týždňov).
    Čisto RLS/FE.
    """

    rows = db_get_weekly_for_user_plan(
        user_id=user_id,
        ctx=ctx,
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
        "weeks": weeks_out,
    }
