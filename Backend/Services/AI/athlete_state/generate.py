from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Services.user_prefs import service_load_user_settings
from Services.AI.athlete_state.prompts import build_prompts_for_analyze, build_prompts_for_progress
from Services.AI.provider.provider import ai_call_json_model

from Modules.Supabase.auth import AuthCtx

def _safe_user_id_from_context(context_payload: dict) -> Optional[int]:
    try:
        v = context_payload.get("user_id")
        return int(v) if v is not None else None
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

def _get_trace_from_result(res: Any, requested_model: str) -> Dict[str, Any]:
    tr = getattr(res, "trace", None) or {}
    err = getattr(res, "error", None)
    
    if not tr and err:
        tr = getattr(err, "trace", None) or {}

    if not isinstance(tr, dict):
        tr = {}

    provider = str(getattr(res, "provider", None) or getattr(err, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or getattr(err, "model", None) or requested_model)

    tr.setdefault("provider", provider)
    tr.setdefault("ok_model", used_model)
    return tr

def generate_athlete_state_json(
    context_payload: dict,
    model: str,
    ctx: AuthCtx,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    
    user_id = _safe_user_id_from_context(context_payload)
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
        except Exception:
            pass

    tzinfo = _tzinfo_from_settings(settings)
    system_txt, user_txt = build_prompts_for_analyze(context_payload, settings=settings, ctx=ctx)

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
    )

    trace = _get_trace_from_result(res, requested_model=model)

    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(getattr(res, "data") or {})
        parsed["schema_version"] = 1
        parsed["generated_at"] = _now_local_iso(tzinfo)
        parsed["model"] = str(getattr(res, "model", None) or model) 
        
        if not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace, None

    provider_name = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or model)

    err_msg = None
    try:
        err = getattr(res, "error", None)
        err_msg = getattr(err, "message", None) if err else None
    except Exception:
        pass

    last_err = err_msg or "AI provider call failed"
    trace.setdefault("provider", provider_name)
    trace.setdefault("ok_model", used_model)
    trace["error"] = last_err

    return None, trace, last_err


def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: str,
    user_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
        except Exception:
            pass

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
        parsed["schema_version"] = 1
        parsed["generated_at"] = _now_local_iso(tzinfo)
        parsed["model"] = str(getattr(res, "model", None) or model)

        if not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace, None

    provider_name = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or model)

    err_msg = None
    try:
        err = getattr(res, "error", None)
        err_msg = getattr(err, "message", None) if err else None
    except Exception:
        pass

    last_err = err_msg or "AI provider call failed"
    trace.setdefault("provider", provider_name)
    trace.setdefault("ok_model", used_model)
    trace["error"] = last_err

    return None, trace, last_err