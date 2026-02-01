# Routes_AI/athlete_state_generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Services.user_prefs import service_load_user_settings

from Routes_AI.athlete_state_prompts import (
    build_prompts_for_analyze,
    build_prompts_for_progress,
)

from Services.AI.provider import ai_call_json_model


def _safe_user_id_from_context(context_payload: dict) -> Optional[int]:
    """
    user_id ber radšej z context_payload.user_id (autorita).
    """
    try:
        v = context_payload.get("user_id")
        if v is None:
            return None
        return int(v)
    except Exception:
        return None


def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    return datetime.now(tzinfo).isoformat()


def _trace_base(
    *,
    provider: str,
    model: str,
    debug_raw: bool,
    ai_debug_trace: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Normalizovaný trace objekt pre FE/billing:
      - models_tried: list
      - attempts: list
      - usage: dict (zatiaľ prázdne, kým nevyťahujeme tokeny z providerov)
    """
    t: Dict[str, Any] = {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": {},
        "ok_model": model,
    }

    # ak provider vrátil vlastný trace (napr. z AiError.trace), skús ho prebrať
    if isinstance(ai_debug_trace, dict):
        mt = ai_debug_trace.get("models_tried")
        at = ai_debug_trace.get("attempts")
        if isinstance(mt, list):
            t["models_tried"] = mt
        if isinstance(at, list):
            t["attempts"] = at

        # ak niekedy doplníme usage do trace v clients, tu to automaticky preberie
        u = ai_debug_trace.get("usage")
        if isinstance(u, dict):
            t["usage"] = u

        # raw/cleaned len ak debug
        if debug_raw:
            if "raw" in ai_debug_trace:
                t["raw"] = ai_debug_trace.get("raw")
            if "cleaned" in ai_debug_trace:
                t["cleaned"] = ai_debug_trace.get("cleaned")

    return t


def generate_athlete_state_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Provider-aware (OpenAI/Gemini) generate analyze JSON.
    Zachováva pôvodný výstup + fallback štruktúru.
    """
    user_id = _safe_user_id_from_context(context_payload)

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)

    system_txt, user_txt = build_prompts_for_analyze(
        context_payload,
        settings=settings,
    )

    # Provider call (OpenAI alebo Gemini podľa AI_PROVIDER)
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        debug_raw=debug_raw,
        # max_tokens/temperature nech sa riadia globálne (Configs/env),
        # ale keď chceš override sem, môžeš doplniť:
        # max_tokens=...,
        # temperature=...,
    )

    # --- Success path ---
    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(res.data)

        now_local = _now_local_iso(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = parsed.get("generated_at") or now_local
        parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)

        # Trace (ak clients nepodporujú success-trace, stále dáme aspoň meta)
        trace = _trace_base(
            provider=str(getattr(res, "provider", None) or "unknown"),
            model=str(getattr(res, "model", None) or model),
            debug_raw=debug_raw,
            ai_debug_trace=(getattr(getattr(res, "error", None), "trace", None) if debug_raw else None),
        )

        return parsed, (trace if debug_raw else None)

    # --- Failure path ---
    provider_name = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or model)
    err_msg = None
    try:
        err = getattr(res, "error", None)
        err_msg = getattr(err, "message", None) if err else None
    except Exception:
        err_msg = None

    last_err = err_msg or "AI provider call failed"

    now_fallback = _now_local_iso(tzinfo)
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "analyze-fallback",
        "user_summary": {
            "headline": "Nepodarilo sa získať AI analýzu.",
            "bullets": ["Skús to znova neskôr."],
            "risks": [],
            "suggestions_short": [],
        },
        "ai_state": {
            "fitness_level": {"run": {"level_1_to_10": 5, "comment": None}, "ride": None, "strength": None},
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {"weekly_minutes_min": None, "weekly_minutes_max": None, "note": last_err},
            "intensity_tolerance": {"hard_sessions_per_week_max": None, "comment": None},
            "suggested_block_kind": "regeneration",
            "key_limitations": [],
            "key_strengths": [],
            "metrics": {
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
            "plan_adjustment": {
                "soften_next_days": {"should_soften": False, "days": None, "reason": None},
                "should_replan_weekly": False,
                "weekly_replan_reason": None,
                "should_notify_user": False,
                "notify_message": None,
            },
        },
        "error": last_err,
    }

    trace = _trace_base(
        provider=provider_name,
        model=used_model,
        debug_raw=debug_raw,
        ai_debug_trace=(getattr(getattr(res, "error", None), "trace", None) if debug_raw else None),
    )
    if debug_raw:
        trace["error"] = last_err

    return fallback, (trace if debug_raw else None)


def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: str,
    user_id: Optional[int] = None,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Provider-aware progress report.
    Zachováva pôvodný výstup + fallback štruktúru.
    """
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)

    system_txt, user_txt = build_prompts_for_progress(
        previous_state=previous_state,
        current_state=current_state,
        settings=settings,
    )

    # Pri progress reporte dáva zmysel poslať kontext ako dict.
    # Ak tvoj prompt builder už vkladá JSON do user_txt, je to stále OK,
    # len sa kontext pošle dvakrát (nie fatálne).
    # Keď budeš chcieť, zoptimalizujeme prompt builder aby nevkladal JSON.
    context_payload = {
        "previous_state": previous_state,
        "current_state": current_state,
        "user_id": user_id,
        "settings": settings,
    }

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        debug_raw=debug_raw,
    )

    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(res.data)

        now_local = _now_local_iso(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = parsed.get("generated_at") or now_local
        parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)

        trace = _trace_base(
            provider=str(getattr(res, "provider", None) or "unknown"),
            model=str(getattr(res, "model", None) or model),
            debug_raw=debug_raw,
            ai_debug_trace=(getattr(getattr(res, "error", None), "trace", None) if debug_raw else None),
        )

        return parsed, (trace if debug_raw else None)

    provider_name = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or model)
    err_msg = None
    try:
        err = getattr(res, "error", None)
        err_msg = getattr(err, "message", None) if err else None
    except Exception:
        err_msg = None

    last_err = err_msg or "AI provider call failed"

    now_fallback = _now_local_iso(tzinfo)
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "progress-fallback",
        "summary": {
            "headline": "Nepodarilo sa získať AI progress report.",
            "bullets": ["Skús to neskôr alebo manuálne porovnaj posledné dve analýzy."],
        },
        "comparisons": {},
        "recommendations": {"celebrations": [], "risks_to_watch": [], "focus_next_weeks": []},
        "error": last_err,
    }

    trace = _trace_base(
        provider=provider_name,
        model=used_model,
        debug_raw=debug_raw,
        ai_debug_trace=(getattr(getattr(res, "error", None), "trace", None) if debug_raw else None),
    )
    if debug_raw:
        trace["error"] = last_err

    return fallback, (trace if debug_raw else None)