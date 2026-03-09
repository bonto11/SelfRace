# Routes_AI/weekly_plan_generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Configs.config import LLM_MAX_TOKENS, LLM_TEMPERATURE
from Services.user_prefs import service_load_user_settings
from Routes_AI.weekly_plan_prompts import build_prompts_for_weekly
from Services.AI.provider.provider import ai_call_json_model
from Modules.Supabase.auth import AuthCtx


def _trace_fallback(*, provider: str, model: str) -> Dict[str, Any]:
    return {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": None,
        "ok_model": model,
    }


def _get_trace_from_result(res: Any, *, requested_model: Optional[str]) -> Dict[str, Any]:
    provider = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or requested_model or "unknown")

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


def generate_weekly_plan_json(
    context_payload: dict,
    ctx:AuthCtx,
    model: Optional[str] = None,
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    
) -> Tuple[dict, Dict[str, Any]]:
    """
    Provider-agnostic weekly plan generator.
    ✅ ALWAYS returns (weekly_plan_dict, trace)
    """
    context: Dict[str, Any] = context_payload if isinstance(context_payload, dict) else {}

    # authoritative user_id is always context["user_id"]
    user_id: Optional[int] = None
    try:
        uid = context.get("user_id")
        user_id = int(uid) if uid is not None else None
    except Exception:
        user_id = None

    # user settings (lang/tz)
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=int(user_id)) or {}
        except Exception:
            settings = {}

    system_txt, user_txt = build_prompts_for_weekly(context, settings=settings)

    # authoritative weeks horizon
    try:
        horizon_weeks = int(context.get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    tz_name = (settings.get("timezone") or "Europe/Bratislava") if isinstance(settings, dict) else "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    resolved_max_tokens = int(max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2000))
    resolved_temperature = float(temperature if temperature is not None else (LLM_TEMPERATURE or 0.2))

    requested_model = model.strip() if isinstance(model, str) and model.strip() else None

    res = ai_call_json_model(
        context_payload=context,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=requested_model,
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
    )

    # trace: always
    trace: Dict[str, Any] = _get_trace_from_result(res, requested_model=requested_model)
    trace.setdefault("max_tokens", resolved_max_tokens)
    trace.setdefault("temperature", resolved_temperature)
    trace.setdefault("timezone", str(tz_name))
    trace["ok"] = bool(getattr(res, "ok", False))

    # Success path (Pylance-safe)
    if bool(getattr(res, "ok", False)):
        data = getattr(res, "data", None)
        if isinstance(data, dict):
            parsed: Dict[str, Any] = dict(data)

            now_local = datetime.now(tzinfo)
            parsed["schema_version"] = int(parsed.get("schema_version") or 1)
            parsed["generated_at"] = now_local.isoformat()
            parsed["model"] = str(getattr(res, "model", None) or requested_model)

            plan_meta = parsed.get("plan_meta")
            if not isinstance(plan_meta, dict):
                plan_meta = {}

            # FORCE: weeks must match horizon_weeks
            plan_meta["weeks"] = int(horizon_weeks)
            parsed["plan_meta"] = plan_meta

            # sync trace ok_model
            if not trace.get("ok_model"):
                trace["ok_model"] = parsed["model"]

            return parsed, trace

    # Failure path
    err = getattr(res, "error", None)
    err_code = getattr(err, "code", None) if err is not None else "ai_failed"
    err_msg = getattr(err, "message", None) if err is not None else "AI provider failed"

    now_iso = datetime.now(tzinfo).isoformat()

    prefs_fb = context.get("prefs") or {}
    if isinstance(prefs_fb, dict) and isinstance(prefs_fb.get("value"), dict):
        prefs_fb = prefs_fb["value"]

    fallback: Dict[str, Any] = {
        "schema_version": 1,
        "generated_at": now_iso,
        "model": "weekly-fallback",
        "plan_meta": {
            "start_date": (
                (prefs_fb.get("start_date") or prefs_fb.get("plan_start_date"))
                if isinstance(prefs_fb, dict)
                else None
            ),
            "weeks": int(horizon_weeks),
            "main_sport": ((prefs_fb.get("main_sport") if isinstance(prefs_fb, dict) else None) or "run"),
            "goal_kind": ((prefs_fb.get("goal_kind") if isinstance(prefs_fb, dict) else None) or "improve_overall"),
        },
        "weeks": [],
        "error": err_msg or "AI provider failed",
        "error_code": err_code or "ai_failed",
        "provider": getattr(res, "provider", None),
        "provider_model": getattr(res, "model", None),
    }

    trace["error_code"] = fallback["error_code"]
    trace["error_message"] = fallback["error"]

    return fallback, trace