# Services/AI/athlete_state/main.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

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


# ============================================================
# HELPERS
# ============================================================

def _now_iso() -> str:
    """Aktuálny UTC čas ako ISO string."""
    return datetime.now(timezone.utc).isoformat()


def _get_optional_int(v: Any) -> Optional[int]:
    """Bezpečná konverzia na int."""
    try:
        return int(v) if v is not None else None
    except Exception:
        return None


def _minify_context_for_ai(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Deep copy s konverziou neserializovateľných hodnôt na string."""
    return json.loads(json.dumps(payload, default=str))


# ============================================================
# UKLADANIE VEDĽAJŠÍCH VÝSTUPOV Z AI
# ============================================================

def _maybe_save_estimated_vo2max(
    user_id: int, analysis: Dict[str, Any], ctx: AuthCtx
) -> None:
    """Uloží VO2max odhad z AI analýzy do user metrics ak existuje."""
    try:
        ai_state = analysis.get("ai_state") or {}
        metrics = ai_state.get("metrics") or {}
        vo2_val = metrics.get("estimated_vo2max")
        if vo2_val and isinstance(vo2_val, (int, float)):
            db_insert_metrics(
                [
                    {
                        "user_id": user_id,
                        "metric": "vo2max_estimated",
                        "value_num": float(vo2_val),
                        "unit": "ml/kg/min",
                        "measured_at": analysis.get("generated_at") or _now_iso(),
                        "source": "system",
                        "note": f"AI Estimate (model: {analysis.get('model')})",
                    }
                ],
                ctx=ctx,
            )
    except Exception as e:
        print(f"[AI-STATE] Error saving VO2Max metric: {repr(e)}")


def _maybe_save_estimated_paces(
    user_id: int, analysis: Dict[str, Any], ctx: AuthCtx
) -> None:
    """Uloží odhadované tempo zóny a race časy z AI analýzy do pace history."""
    try:
        ai_state = analysis.get("ai_state") or {}
        paces = ai_state.get("estimated_paces") or {}
        metrics = ai_state.get("metrics") or {}
        if not paces and not metrics:
            return

        def _get_int(d: dict, key: str) -> Optional[int]:
            val = d.get(key)
            if val is not None and isinstance(val, (int, float)):
                return int(val)
            return None

        row = {
            "user_id": user_id,
            "measured_at": analysis.get("generated_at") or _now_iso(),
            "z1_pace_s": _get_int(paces, "z1_pace_s"),
            "z2_pace_s": _get_int(paces, "z2_pace_s"),
            "z3_pace_s": _get_int(paces, "z3_pace_s"),
            "z4_pace_s": _get_int(paces, "z4_pace_s"),
            "z5_pace_s": _get_int(paces, "z5_pace_s"),
            "best_1k_s": _get_int(paces, "best_1k_s"),
            "est_5k_time_s": _get_int(metrics, "estimated_5k_time_s"),
            "est_10k_time_s": _get_int(metrics, "estimated_10k_time_s"),
            "est_half_marathon_time_s": _get_int(metrics, "estimated_half_marathon_time_s"),
            "est_marathon_time_s": _get_int(metrics, "estimated_marathon_time_s"),
        }
        has_data = any(
            v is not None for k, v in row.items() if k not in ("user_id", "measured_at")
        )
        if has_data:
            db_insert_pace_row(row, ctx=ctx)
    except Exception as e:
        print(f"[AI-STATE] Error saving estimated paces: {repr(e)}")


def _log_ai_usage(
    user_id: int,
    trace: Dict[str, Any],
    model: str,
    job_type: str,
    ctx: AuthCtx,
) -> None:
    """Zaloguje AI usage s provider a model z trace — pre billing a debug."""
    usage = extract_usage_from_trace(trace, model_fallback=model)
    if not usage:
        return
    try:
        log_ai_usage_for_user(
            user_id=user_id,
            usage=usage,
            job_type=job_type,
            source="user",
            billed_via="internal",
            charge_wallet=False,
            meta={
                "provider": trace.get("ok_provider"),
                "model": trace.get("ok_model"),
            },
            ctx=ctx,
        )
    except Exception as e:
        print(f"[AI_BILLING] {job_type} billing error: {repr(e)}")


# ============================================================
# READ SERVICES
# ============================================================

def service_save_state_to_db(
    user_id: int, analysis: Dict[str, Any], *, ctx: AuthCtx
) -> Optional[int]:
    """Uloží AI state analýzu do DB a vráti state_id."""
    return db_insert_athlete_state(
        user_id=user_id,
        model=str(analysis.get("model")),
        state_json=analysis,
        version=int(analysis.get("schema_version") or 1),
        ctx=ctx,
    )


def service_get_athlete_state_by_id(
    state_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Načíta konkrétny athlete state podľa ID."""
    row = db_get_state_by_id(state_id, ctx=ctx)
    if not row:
        return None
    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": row.get("state_json") or {},
        "compare_previous": row.get("compare_previous"),
    }


def service_get_latest_athlete_state(
    user_id: int, version: Optional[int] = 1, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Načíta posledný athlete state pre usera — bez interných debug polí."""
    row = db_get_latest_state_for_user(user_id=user_id, version=version, ctx=ctx)
    if not row:
        return None

    full_state = row.get("state_json") or {}
    clean_state = full_state.get("analysis", full_state)
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
    user_id: int, limit: int = 20, *, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """Vráti zoznam athlete state metadát (bez state_json) pre daného usera."""
    rows = db_list_states_for_user(user_id=user_id, limit=limit, ctx=ctx)
    return [
        {
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "model": r.get("model"),
            "version": r.get("version"),
            "created_at": r.get("created_at"),
        }
        for r in (rows or [])
    ]


def service_get_latest_athlete_progress(
    user_id: int, *, version: Optional[int] = 1, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Načíta posledný progress report pre usera."""
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


# ============================================================
# CORE: ANALYZE ATHLETE
# ============================================================

def service_analyze_athlete(
    user_id: int, *, ctx: AuthCtx, model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Hlavný service pre AI analýzu stavu športovca.
    Zostaví kontext z DB, zavolá AI, uloží výsledky, spustí progress porovnanie.
    model=None = provider použije default z ENV (odporúčané).
    """
    # Kvóta check
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    # Builder — zostaví kompletný kontext z DB
    input_data = build_input_from_db(user_id=user_id, ctx=ctx)
    context_for_ai = _minify_context_for_ai(input_data)

    # Odstránenie interných polí pred odoslaním do AI
    u = context_for_ai.get("user")
    if isinstance(u, dict):
        u.pop("id", None)

    prefs_block = context_for_ai.get("prefs") or {}
    if isinstance(prefs_block, dict):
        pv = prefs_block.get("value")
        if isinstance(pv, dict):
            pv.pop("external_activities", None)
        prefs_block.pop("external_activities", None)

    # AI generovanie — provider vyberie model podľa ENV
    analysis, trace, err_msg = generate_athlete_state_json(
        context_payload=context_for_ai,
        model=model,
        ctx=ctx,
    )

    if not analysis:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())

    # Billing
    _log_ai_usage(user_id, trace, str(analysis.get("model") or ""), "coach.analyze_state", ctx)

    # Plan adjustment signály
    try:
        signals = compute_plan_adjustment_signals(
            analyze_input=input_data, analysis=analysis
        )
    except Exception as e:
        print(f"[service_analyze_athlete] plan_adjustment error: {repr(e)}")
        signals = {
            "soften_next_days": {"should_soften": False, "days": None, "reason": None},
            "should_replan_weekly": False,
            "weekly_replan_reason": None,
        }

    ai_state = analysis.setdefault("ai_state", {})
    soften = signals.get("soften_next_days") or {}
    ai_state["plan_adjustment"] = {
        "soften_next_days": {
            "should_soften": bool(soften.get("should_soften")),
            "days": soften.get("days"),
            "reason": soften.get("reason"),
        },
        "should_replan_weekly": bool(signals.get("should_replan_weekly")),
        "weekly_replan_reason": signals.get("weekly_replan_reason"),
    }

    # Uloženie do DB
    state_id = service_save_state_to_db(user_id=user_id, analysis=analysis, ctx=ctx)

    # Vedľajšie výstupy
    _maybe_save_estimated_vo2max(user_id, analysis, ctx)
    _maybe_save_estimated_paces(user_id, analysis, ctx)

    # Progress porovnanie s predchádzajúcim stavom
    compare_previous: Optional[Dict[str, Any]] = None
    try:
        progress_result = service_compare_latest_athlete_states(
            user_id=user_id,
            version=int(analysis.get("schema_version") or 1),
            model=model,
            ctx=ctx,
        )
        if progress_result.get("ok") and progress_result.get("report"):
            compare_previous = progress_result.get("report")
    except Exception as e:
        print(f"[service_analyze_athlete] compare_previous error: {repr(e)}")

    resp: Dict[str, Any] = {
        "ok": True,
        "state_id": state_id,
        "model": str(analysis.get("model") or ""),
        "analysis": analysis,
        "error": None,
    }
    if compare_previous is not None:
        resp["compare_previous"] = compare_previous

    return resp


# ============================================================
# CORE: COMPARE STATES
# ============================================================

def service_compare_latest_athlete_states(
    user_id: int,
    *,
    version: Optional[int] = 1,
    ctx: AuthCtx,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Porovná dva posledné athlete states a vygeneruje progress report.
    model=None = provider použije default z ENV.
    """
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

    report, trace, err_msg = generate_athlete_progress_report(
        previous_state=previous.get("state_json") or {},
        current_state=current.get("state_json") or {},
        model=model,
        user_id=user_id,
        ctx=ctx,
    )

    if not report:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    report.setdefault("schema_version", 1)
    report.setdefault("generated_at", _now_iso())

    # Billing
    _log_ai_usage(user_id, trace, str(report.get("model") or ""), "coach.progress_report", ctx)

    # Uloženie reportu k aktuálnemu stavu
    try:
        sid = _get_optional_int(current.get("id"))
        if sid is not None:
            db_update_state_compare_previous(
                state_id=sid, compare_previous=report, ctx=ctx
            )
    except Exception as e:
        print(f"[service_compare] db_update error: {repr(e)}")

    # Push notifikácia
    try:
        service_notify_athlete_state_progress(user_id=user_id, ctx=ctx)
    except Exception as e:
        print(f"[service_compare] push notification error: {repr(e)}")

    return {
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


# ============================================================
# WEEKLY BATCH JOB
# ============================================================

def service_run_weekly_athlete_state(
    max_users: int, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Spúšťa weekly athlete state analýzu pre všetkých userov.
    Volaný schedulerom každú nedeľu. model=None = ENV default.
    """
    users = db_list_users_for_athlete_state(ctx=ctx, limit=max_users or 1000)
    if not users:
        return {"success": True, "processed": 0, "results": [], "message": "no users found"}

    results: List[Dict[str, Any]] = []
    processed = 0

    for row in users:
        uid = row.get("id")
        if not uid:
            continue
        try:
            resp = service_analyze_athlete(ctx=ctx, user_id=int(uid), model=None)
            state_id = resp.get("state_id")
            results.append(
                {"user_id": uid, "state_id": state_id, "ok": bool(state_id is not None)}
            )
            processed += 1
        except Exception as e:
            results.append({"user_id": uid, "state_id": None, "ok": False, "error": str(e)})

    return {"success": True, "processed": processed, "results": results}