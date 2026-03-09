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
from Modules.Supabase.auth import AuthCtx

from Services.AI.provider.provider import ai_call_json_model


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


def _trace_fallback(*, provider: str, model: str) -> Dict[str, Any]:
    """
    Minimal trace objekt (keď klient nič nevrátil).
    """
    return {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": None,   # sem sa má ukladať {prompt_tokens, completion_tokens, total_tokens, reasoning_tokens}
        "ok_model": model,
    }


def _get_trace_from_result(res: Any, *, requested_model: str) -> Dict[str, Any]:
    provider = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or requested_model)

    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        tr.setdefault("provider", provider)
        tr.setdefault("models_tried", [])
        tr.setdefault("attempts", [])
        tr.setdefault("usage", None)
        tr.setdefault("ok_model", used_model)
        return tr

    err = getattr(res, "error", None)
    tr2 = getattr(err, "trace", None) if err is not None else None
    if isinstance(tr2, dict):
        tr2.setdefault("provider", provider)
        tr2.setdefault("models_tried", [])
        tr2.setdefault("attempts", [])
        tr2.setdefault("usage", None)
        tr2.setdefault("ok_model", used_model)
        return tr2

    return _trace_fallback(provider=provider, model=used_model)

def generate_athlete_state_json(
    context_payload: dict,
    model: str,
    ctx:AuthCtx,
) -> Tuple[dict, Dict[str, Any]]:
    """
    Provider-aware (OpenAI/Gemini) generate analyze JSON.
    ✅ Vracia (data, trace) VŽDY.
    """
    user_id = _safe_user_id_from_context(context_payload)

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx,user_id=user_id) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)

    system_txt, user_txt = build_prompts_for_analyze(
        context_payload,
        settings=settings,
        ctx=ctx,
    )

    print("generate_athlete_state_json context_payload",context_payload)
    print("generate_athlete_state_json system_txt",system_txt)
    print("generate_athlete_state_json user_txt",user_txt)
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
    )
    print("generate_athlete_state_json res",res)

    trace = _get_trace_from_result(res, requested_model=model)

    # --- Success path ---
    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(getattr(res, "data") or {})

        now_local = _now_local_iso(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = now_local   
        parsed["model"] = str(getattr(res, "model", None) or model) 
        # sync trace ok_model
        if isinstance(trace, dict) and not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace

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

    # doplň trace error (ale trace nech je vždy)
    trace.setdefault("provider", provider_name)
    trace.setdefault("ok_model", used_model)
    trace["error"] = last_err

    return fallback, trace


def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: str,
    user_id: Optional[int] = None,
    ctx:AuthCtx,
) -> Tuple[dict, Dict[str, Any]]:
    """
    Provider-aware progress report.
    ✅ Vracia (data, trace) VŽDY.
    """
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)

    system_txt, user_txt = build_prompts_for_progress(
        previous_state=previous_state,
        current_state=current_state,
        settings=settings,
        ctx=ctx,
    )

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
    )

    trace = _get_trace_from_result(res, requested_model=model)

    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(getattr(res, "data") or {})

        now_local = _now_local_iso(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        
        # ✅ OPRAVA DÁTUMU: Natvrdo prepíšeme AI výmysel skutočným aktuálnym časom
        parsed["generated_at"] = now_local
        
        parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)

        if isinstance(trace, dict) and not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace

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

    trace.setdefault("provider", provider_name)
    trace.setdefault("ok_model", used_model)
    trace["error"] = last_err

    return fallback, trace