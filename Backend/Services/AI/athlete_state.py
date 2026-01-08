# Services/AI/athlete_state.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from Routes_AI.analyze_athlete_state import (
    generate_athlete_state_json,
    generate_athlete_progress_report,
)

from Routes_DB.coach_athlete_state import (
    db_insert_athlete_state,
    db_get_state_by_id,
    db_get_latest_state_for_user,
    db_get_latest_states_for_user,
    db_list_states_for_user,
    db_update_state_compare_previous,
    db_get_latest_athlete_progress,
)

from Services.users import require_jwt
from Services.AI.athlete_state_input_builder import build_input_from_db
from Services.AI.athlete_state_signals import compute_plan_adjustment_signals

from Services.AI.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
)

from Configs.config import DEFAULT_MODEL


# -------------------- HELPERS --------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -------------------- STORAGE --------------------


def service_save_state_to_db(
    user_id: int,
    analysis: Dict[str, Any],
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
) -> Optional[int]:
    """
    Uloží AI stav atleta do coach_athlete_state.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    model = str(analysis.get("model") or "Trainalyze Coach")
    version = int(analysis.get("schema_version") or 1)
    return db_insert_athlete_state(
        user_id=user_id,
        model=model,
        state_json=analysis,
        version=version,
        user_jwt=jwt,
        service=service,
    )


def service_get_athlete_state_by_id(
    state_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny záznam z coach_athlete_state podľa id
    a rozbalí state_json do samostatného kľúča "state".
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_state_by_id(
        state_id,
        user_jwt=jwt,
        service=service,
    )
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
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší stav pre usera (podľa created_at DESC).
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_latest_state_for_user(
        user_id=user_id,
        version=version,
        user_jwt=jwt,
        service=service,
    )
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


def service_list_athlete_states_meta(
    user_id: int,
    limit: int = 20,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    História stavov – len meta info (bez state_json),
    vhodné na výpis v UI / debug.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    rows = db_list_states_for_user(
        user_id=user_id,
        limit=limit,
        user_jwt=jwt,
        service=service,
    )
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


# -------------------- PUBLIC SERVICE: DB → AI → DB/FE --------------------


def service_analyze_athlete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    debug: bool = False,
    save_to_db: bool = True,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia pre AI analýzu atleta.

    - service=False (FE): kontroluje mesačný limit AI tokenov.
    - service=True  (cron/webhook): ignoruje limit, ide cez service klienta.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    # 0) QUOTA CHECK – obmedzenie pre user-trigger volania
    if not service and is_user_over_token_quota(user_id):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "state_id": None,
            "model": model or DEFAULT_MODEL,
            "analysis": None,
            "input": None,
            "error": {
                "code": "ai_quota_exceeded",
                "message": (
                    "Mesačný limit AI analýz bol vyčerpaný. "
                    "Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj."
                ),
                "used_tokens_this_month": used,
            },
        }

    # 1) INPUT
    input_data = build_input_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # 1b) Kontext pre AI – deep copy + drop external_activities z prefs (ak sú)
    context_for_ai = json.loads(json.dumps(input_data, default=str))
    try:
        prefs_block = context_for_ai.get("prefs") or {}
        if isinstance(prefs_block, dict):
            prefs_val = prefs_block.get("value")
            if isinstance(prefs_val, dict):
                prefs_val.pop("external_activities", None)
            prefs_block.pop("external_activities", None)
    except Exception:
        pass

    # 2) AI CALL – čistý výstup z AI = "analysis"
    model_to_use = model or DEFAULT_MODEL
    analysis, trace = generate_athlete_state_json(
        context_payload=context_for_ai,
        model=model_to_use,
    )

    if not isinstance(analysis, dict):
        analysis = {}

    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())
    analysis.setdefault("model", "Coach BeTY")

    # === AI BILLING – usage za ANALYZE =====================
    usage = extract_usage_from_trace(trace)
    if usage:
        # prepíš model v usage na reálne použitý
        if model_to_use:
            usage["model"] = model_to_use
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.analyze_state",
                source="service" if service else "user",
                billed_via="internal",  # zatiaľ len interné logovanie
                charge_wallet=False,
                meta={},
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] analyze_state billing error:", repr(e))
    # =======================================================

    # 2b) deterministic plan_adjustment z našich heuristík
    try:
        signals = compute_plan_adjustment_signals(
            analyze_input=input_data,
            analysis=analysis,
        )
    except Exception as e:
        print("[service_analyze_athlete] plan_adjustment error:", repr(e))
        signals = {
            "soften_next_days": {
                "should_soften": False,
                "days": None,
                "reason": None,
            },
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

    # 3) STORAGE + progress report
    state_id: Optional[int] = None
    compare_previous: Optional[Dict[str, Any]] = None

    if save_to_db:
        state_id = service_save_state_to_db(
            user_id=user_id,
            analysis=analysis,
            user_jwt=jwt if not service else None,
            service=service,
        )

        try:
            progress_result = service_compare_latest_athlete_states(
                user_id=user_id,
                version=analysis.get("schema_version") or 1,
                user_jwt=user_jwt if not service else None,
                service=service,
                model=model_to_use,
                debug=False,
            )
            if progress_result.get("ok") and progress_result.get("report"):
                compare_previous = progress_result.get("report")
        except Exception as e:  # noqa: BLE001
            print("[service_analyze_athlete] compare_previous error:", repr(e))

    resp: Dict[str, Any] = {
        "state_id": state_id,
        "model": model_to_use,
        "analysis": analysis,
        "input": input_data,
    }
    if compare_previous is not None:
        resp["compare_previous"] = compare_previous
    if debug:
        resp["debug_trace"] = trace
        resp["ai_usage"] = usage

    return resp


def service_compare_latest_athlete_states(
    user_id: int,
    *,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Zoberie posledné dva uložené stavy atleta a spraví AI progress report.
    Report sa zároveň uloží do compare_previous na najnovšom state.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    # voliteľne: quota check aj tu (aby FE nemohol spamovať progress report)
    if not service and is_user_over_token_quota(user_id):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "ok": False,
            "error": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "user_id": user_id,
            "used_tokens_this_month": used,
        }

    rows = db_get_latest_states_for_user(
        user_id=user_id,
        limit=2,
        version=version,
        user_jwt=jwt,
        service=service,
    )

    if len(rows) < 2:
        return {
            "ok": False,
            "error": "not_enough_states",
            "message": "Na porovnanie sú potrebné aspoň dve AI analýzy.",
            "user_id": user_id,
        }

    current = rows[0]
    previous = rows[1]

    current_state = current.get("state_json") or {}
    previous_state = previous.get("state_json") or {}

    model_to_use = model or DEFAULT_MODEL

    # 2) AI report
    report, trace = generate_athlete_progress_report(
        previous_state=previous_state,
        current_state=current_state,
        model=model_to_use,
        user_id=user_id,
        debug_raw=debug,
    )

    # === AI BILLING – usage za PROGRESS REPORT ============
    usage = extract_usage_from_trace(trace)
    if usage:
        if model_to_use:
            usage["model"] = model_to_use
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.progress_report",
                source="service" if service else "user",
                billed_via="internal",
                charge_wallet=False,
                meta={},
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] progress_report billing error:", repr(e))
    # ======================================================

    # 3) uložíme report do compare_previous na aktuálnom zázname
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
                user_jwt=jwt,
                service=service,
            )
    except Exception as e:  # noqa: BLE001
        print(
            "[service_compare_latest_athlete_states] db_update_state_compare_previous error:",
            repr(e),
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
    if debug:
        resp["debug_trace"] = trace
        resp["ai_usage"] = usage

    return resp


def service_get_latest_athlete_progress(
    user_id: int,
    *,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší progress report (compare_previous) pre usera.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_latest_athlete_progress(
        user_id=user_id,
        version=version,
        user_jwt=jwt,
        service=service,
    )
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
