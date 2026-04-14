from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from Configs.config import (
    AI_PROVIDER,
    OPENAI_DEFAULT_MODEL,
    GEMINI_DEFAULT_MODEL,
)

from DB.user_metrics import db_insert_metrics
from DB.user_pace_history import db_insert_pace_row
from DB.coach_athlete_state import (
    db_insert_athlete_state,
    db_get_state_by_id,
    db_get_latest_state_for_user,
    db_get_latest_states_for_user,
    db_list_states_for_user,
    db_update_state_compare_previous,
    db_get_latest_athlete_progress,
)
from DB.users import db_list_users_for_athlete_state
from Services.notifications import service_notify_athlete_state_progress

from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
)
from Services.AI.utils.athlete_state_signals import compute_plan_adjustment_signals
from Services.AI.athlete_state.builders import build_input_from_db
from Services.AI.athlete_state.generate import (
    generate_athlete_state_json,
    generate_athlete_progress_report,
)

from Modules.Supabase.auth import AuthCtx

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _default_ai_model() -> str:
    if str(AI_PROVIDER).strip().lower() == "gemini":
        return str(GEMINI_DEFAULT_MODEL).strip()
    return str(OPENAI_DEFAULT_MODEL).strip()

def _maybe_save_estimated_vo2max(user_id: int, analysis: Dict[str, Any], ctx: AuthCtx):
    try:
        ai_state = analysis.get("ai_state") or {}
        metrics = ai_state.get("metrics") or {}
        vo2_val = metrics.get("estimated_vo2max")

        if vo2_val and isinstance(vo2_val, (int, float)):
            metric_row = {
                "user_id": user_id,
                "metric": "vo2max_estimated",
                "value_num": float(vo2_val),
                "unit": "ml/kg/min",
                "measured_at": analysis.get("generated_at") or _now_iso(),
                "source": "system",
                "note": f"AI Estimate (model: {analysis.get('model')})",
            }
            db_insert_metrics([metric_row], ctx=ctx)
    except Exception as e:
        print(f"[AI-STATE] Error saving VO2Max metric: {repr(e)}")

def _maybe_save_estimated_paces(user_id: int, analysis: Dict[str, Any], ctx: AuthCtx):
    try:
        ai_state = analysis.get("ai_state") or {}
        paces = ai_state.get("estimated_paces") or {}
        metrics = ai_state.get("metrics") or {}

        if not paces and not metrics:
            return

        measured_at = analysis.get("generated_at") or _now_iso()

        def _get_int(d: dict, key: str) -> Optional[int]:
            val = d.get(key)
            if val is not None and isinstance(val, (int, float)):
                return int(val)
            return None

        row_to_insert = {
            "user_id": user_id,
            "measured_at": measured_at,
            "z1_pace_s": _get_int(paces, "z1_pace_s"),
            "z2_pace_s": _get_int(paces, "z2_pace_s"),
            "z3_pace_s": _get_int(paces, "z3_pace_s"),
            "z4_pace_s": _get_int(paces, "z4_pace_s"),
            "z5_pace_s": _get_int(paces, "z5_pace_s"),
            "best_1k_s": _get_int(paces, "best_1k_s"),
            "est_5k_time_s": _get_int(metrics, "estimated_5k_time_s"),
            "est_10k_time_s": _get_int(metrics, "estimated_10k_time_s"),
            "est_half_marathon_time_s": _get_int(
                metrics, "estimated_half_marathon_time_s"
            ),
            "est_marathon_time_s": _get_int(metrics, "estimated_marathon_time_s"),
        }

        has_data = any(
            v is not None
            for k, v in row_to_insert.items()
            if k not in ["user_id", "measured_at"]
        )
        if has_data:
            db_insert_pace_row(row_to_insert, ctx=ctx)

    except Exception as e:
        print(f"[AI-STATE] Error saving estimated paces and races: {repr(e)}")

def service_save_state_to_db(
    user_id: int,
    analysis: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Optional[int]:
    model = str(analysis.get("model"))
    version = int(analysis.get("schema_version") or 1)
    return db_insert_athlete_state(
        user_id=user_id,
        model=model,
        state_json=analysis,
        version=version,
        ctx=ctx,
    )

def service_get_athlete_state_by_id(
    state_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    row = db_get_state_by_id(state_id, ctx=ctx)
    if not row:
        return None
    state_json = row.get("state_json") or {}
    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
        "compare_previous": row.get("compare_previous"),
    }

def service_get_latest_athlete_state(
    user_id: int,
    version: Optional[int] = 1,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    row = db_get_latest_state_for_user(user_id=user_id, version=version, ctx=ctx)
    if not row:
        return None
    full_state_json = row.get("state_json") or {}

    clean_state = {}
    if "analysis" in full_state_json:
        clean_state = full_state_json["analysis"]
    else:
        clean_state = full_state_json

    clean_state.pop("input", None)
    clean_state.pop("debug_trace", None)

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": clean_state,
        "compare_previous": row.get("compare_previous"),
    }

def service_list_athlete_states_meta(
    user_id: int,
    limit: int = 20,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    rows = db_list_states_for_user(user_id=user_id, limit=limit, ctx=ctx)
    return [
        {
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "model": r.get("model"),
            "version": r.get("version"),
            "created_at": r.get("created_at"),
        }
        for r in rows or []
    ]

def service_analyze_athlete(
    user_id: int,
    *,
    ctx: AuthCtx,
    model: Optional[str] = None,
) -> Dict[str, Any]:

    model_to_use = (model or _default_ai_model()).strip()

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    input_data = build_input_from_db(user_id=user_id, ctx=ctx)
    context_for_ai = json.loads(json.dumps(input_data, default=str))

    try:
        u = context_for_ai.get("user")
        if isinstance(u, dict):
            u.pop("id", None)
    except Exception:
        pass

    try:
        prefs_block = context_for_ai.get("prefs") or {}
        if isinstance(prefs_block, dict):
            prefs_val = prefs_block.get("value")
            if isinstance(prefs_val, dict):
                prefs_val.pop("external_activities", None)
            prefs_block.pop("external_activities", None)
    except Exception:
        pass

    analysis, trace, err_msg = generate_athlete_state_json(
        context_payload=context_for_ai,
        model=model_to_use,
        ctx=ctx,
    )

    if not analysis:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())
    analysis["model"] = str(analysis.get("model") or model_to_use)

    usage = extract_usage_from_trace(trace)
    if usage:
        usage["model"] = str(analysis.get("model") or model_to_use)
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.analyze_state",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={},
                ctx=ctx,
            )
        except Exception as e:
            print("[AI_BILLING] analyze_state billing error:", repr(e))

    try:
        signals = compute_plan_adjustment_signals(
            analyze_input=input_data,
            analysis=analysis,
        )
    except Exception as e:
        print("[service_analyze_athlete] plan_adjustment error:", repr(e))
        signals = {
            "soften_next_days": {"should_soften": False, "days": None, "reason": None},
            "should_replan_weekly": False,
            "weekly_replan_reason": None,
        }

    ai_state = analysis.setdefault("ai_state", {})
    ai_state["plan_adjustment"] = {
        "soften_next_days": {
            "should_soften": bool(
                (signals.get("soften_next_days") or {}).get("should_soften")
            ),
            "days": (signals.get("soften_next_days") or {}).get("days"),
            "reason": (signals.get("soften_next_days") or {}).get("reason"),
        },
        "should_replan_weekly": bool(signals.get("should_replan_weekly")),
        "weekly_replan_reason": signals.get("weekly_replan_reason"),
    }

    state_id = service_save_state_to_db(user_id=user_id, analysis=analysis, ctx=ctx)

    _maybe_save_estimated_vo2max(user_id, analysis, ctx)
    _maybe_save_estimated_paces(user_id, analysis, ctx)

    compare_previous: Optional[Dict[str, Any]] = None
    try:
        progress_result = service_compare_latest_athlete_states(
            user_id=user_id,
            version=analysis.get("schema_version") or 1,
            model=model_to_use,
            ctx=ctx,
        )
        if progress_result.get("ok") and progress_result.get("report"):
            compare_previous = progress_result.get("report")
    except Exception as e:
        print("[service_analyze_athlete] compare_previous error:", repr(e))

    resp: Dict[str, Any] = {
        "ok": True,
        "state_id": state_id,
        "model": str(analysis.get("model") or model_to_use),
        "analysis": analysis,
        "error": None,
    }
    if compare_previous is not None:
        resp["compare_previous"] = compare_previous

    return resp


def service_compare_latest_athlete_states(
    user_id: int,
    *,
    version: Optional[int] = 1,
    ctx: AuthCtx,
    model: Optional[str] = None,
) -> Dict[str, Any]:

    model_to_use = (model or _default_ai_model()).strip()

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    rows = db_get_latest_states_for_user(
        user_id=user_id, limit=2, version=version, ctx=ctx
    )

    if len(rows or []) < 2:
        return {
            "ok": False,
            "code": "not_enough_states",
            "message": "Na porovnanie sú potrebné aspoň dve AI analýzy.",
        }

    current = rows[0]
    previous = rows[1]

    current_state = current.get("state_json") or {}
    previous_state = previous.get("state_json") or {}

    report, trace, err_msg = generate_athlete_progress_report(
        previous_state=previous_state,
        current_state=current_state,
        model=model_to_use,
        user_id=user_id,
        ctx=ctx,
    )

    if not report:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    report.setdefault("schema_version", 1)
    report.setdefault("generated_at", _now_iso())
    report["model"] = str(report.get("model") or model_to_use)

    usage = extract_usage_from_trace(trace)
    if usage:
        usage["model"] = str(report.get("model") or model_to_use)
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.progress_report",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={},
                ctx=ctx,
            )
        except Exception as e:
            print("[AI_BILLING] progress_report billing error:", repr(e))

    try:
        sid_raw = current.get("id")
        sid: Optional[int]
        if isinstance(sid_raw, int):
            sid = sid_raw
        elif isinstance(sid_raw, str):
            try:
                sid = int(sid_raw)
            except Exception:
                sid = None
        else:
            sid = None

        if sid is not None:
            db_update_state_compare_previous(
                state_id=sid,
                compare_previous=report,
                ctx=ctx,
            )
    except Exception as e:
        print(
            "[service_compare_latest_athlete_states] db_update_state_compare_previous error:",
            repr(e),
        )

    try:
        service_notify_athlete_state_progress(user_id=user_id, ctx=ctx)
    except Exception as e:
        print(
            "[service_compare_latest_athlete_states] push notification error:", repr(e)
        )

    resp: Dict[str, Any] = {
        "ok": True,
        "user_id": user_id,
        "version": version,
        "current_state_id": current.get("id"),
        "previous_state_id": previous.get("id"),
        "current_created_at": current.get("created_at"),
        "previous_created_at": previous.get("created_at"),
        "report": report,
        "source": "generated",
    }
    return resp

def service_get_latest_athlete_progress(
    user_id: int,
    *,
    version: Optional[int] = 1,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:

    row = db_get_latest_athlete_progress(user_id=user_id, version=version, ctx=ctx)
    if not row:
        return None

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "report": row.get("compare_previous") or None,
    }

def service_run_weekly_athlete_state(max_users: int, ctx: AuthCtx) -> Dict[str, Any]:
    users = db_list_users_for_athlete_state(
        ctx=ctx,
        limit=max_users or 1000,
    )

    if not users:
        return {
            "success": True,
            "processed": 0,
            "results": [],
            "message": "no users found",
        }

    results = []
    processed = 0

    for row in users:
        uid = row.get("id")
        if not uid:
            continue

        try:
            resp = service_analyze_athlete(
                ctx=ctx,
                user_id=int(uid),
                model=None,
            )

            state_id = resp.get("state_id")
            results.append(
                {"user_id": uid, "state_id": state_id, "ok": bool(state_id is not None)}
            )
            processed += 1
        except Exception as e:
            results.append(
                {"user_id": uid, "state_id": None, "ok": False, "error": str(e)}
            )

    return {"success": True, "processed": processed, "results": results}