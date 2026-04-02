# Services/AI/weekly_plan/generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Configs.config import LLM_MAX_TOKENS, LLM_TEMPERATURE
from Services.user_prefs import service_load_user_settings
from Services.AI.weekly_plan.prompts import build_prompts_for_weekly
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


def _get_trace_from_result(
    res: Any, *, requested_model: Optional[str]
) -> Dict[str, Any]:
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
    ctx: AuthCtx,
    model: Optional[str] = None,
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:

    context: Dict[str, Any] = (
        context_payload if isinstance(context_payload, dict) else {}
    )

    user_id: Optional[int] = None
    try:
        uid = context.get("user_id")
        user_id = int(uid) if uid is not None else None
    except Exception:
        pass

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=int(user_id)) or {}
        except Exception:
            pass

    system_txt, user_txt = build_prompts_for_weekly(context, settings=settings)

    try:
        horizon_weeks = int(context.get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    tz_name = (
        (settings.get("timezone") or "Europe/Bratislava")
        if isinstance(settings, dict)
        else "Europe/Bratislava"
    )
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    resolved_max_tokens = int(
        max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2000)
    )
    resolved_temperature = float(
        temperature if temperature is not None else (LLM_TEMPERATURE or 0.2)
    )
    requested_model = (
        model.strip() if isinstance(model, str) and model.strip() else None
    )

    print(
        "generate_weekly_plan_json - context_payload, system_txt, user_txt",
        context_payload,
        system_txt,
        user_txt,
    )

    res = ai_call_json_model(
        context_payload=context,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=requested_model,
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
    )

    print("generate_weekly_plan_json - res", res)

    trace: Dict[str, Any] = _get_trace_from_result(res, requested_model=requested_model)
    trace.setdefault("max_tokens", resolved_max_tokens)
    trace.setdefault("temperature", resolved_temperature)
    trace.setdefault("timezone", str(tz_name))
    trace["ok"] = bool(getattr(res, "ok", False))

    # --- Success path ---
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

            plan_meta["weeks"] = int(horizon_weeks)
            parsed["plan_meta"] = plan_meta

            if not trace.get("ok_model"):
                trace["ok_model"] = parsed["model"]

            return parsed, trace, None

    # --- Failure path (Bez fallbacku, len cisty error) ---
    err = getattr(res, "error", None)
    err_code = getattr(err, "code", None) if err is not None else "ai_failed"
    err_msg = getattr(err, "message", None) if err is not None else "AI provider failed"

    trace["error_code"] = err_code
    trace["error_message"] = err_msg

    return None, trace, err_msg
