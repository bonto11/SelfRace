# Routes_AI/weekly_plan_generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Configs.config import LLM_MAX_TOKENS, LLM_TEMPERATURE
from Services.user_prefs import service_load_user_settings
from Routes_AI.weekly_plan_prompts import build_prompts_for_weekly
from Services.AI.provider import ai_call_json_model


def generate_weekly_plan_json(
    context_payload: dict,
    model: Optional[str] = None,
    *,
    debug_raw: bool = False,
    # voliteľné overrides (inak idú env defaulty cez Configs.config)
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[dict, Optional[dict]]:
    """
    Provider-agnostic weekly plan generator.
    - používa Services.AI.provider.ai_call_json_model()
    - neobsahuje žiadne OpenAI importy ani *_llm helpery
    - vracia (weekly_plan_dict, trace_or_None)
    """
    ctx = context_payload if isinstance(context_payload, dict) else {}

    # authoritative user_id is always ctx["user_id"]
    user_id: Optional[int] = None
    try:
        if ctx.get("user_id") is not None:
            user_id = int(ctx["user_id"])
    except Exception:
        user_id = None

    # user settings (lang/tz)
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    system_txt, user_txt = build_prompts_for_weekly(
        ctx,
        settings=settings,
    )

    # authoritative weeks horizon
    horizon_weeks: int = 6
    try:
        horizon_weeks = int(ctx.get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    # timezone for generated_at
    tz_name = (settings.get("timezone") or "Europe/Bratislava") if isinstance(settings, dict) else "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    # resolve defaults
    resolved_max_tokens = int(max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2000))
    resolved_temperature = float(temperature if temperature is not None else (LLM_TEMPERATURE or 0.2))

    # provider call (OpenAI/Gemini)
    # Pozn.: ctx sem posielame kvôli debug/parite + prípadným provider pravidlám,
    # prompt obsahuje CONTEXT_JSON už v user_txt.
    res = ai_call_json_model(
        context_payload=ctx,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=(model.strip() if isinstance(model, str) and model.strip() else None),
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
        debug_raw=debug_raw,
    )

    trace: Optional[dict] = None
    if debug_raw:
        trace = {
            "ok": bool(res.ok),
            "provider": getattr(res, "provider", None),
            "model": getattr(res, "model", None),
            "error_code": (res.error.code if getattr(res, "error", None) else None),
            "error_message": (res.error.message if getattr(res, "error", None) else None),
            # provider-specific trace (len keď debug_raw=True to provider plní)
            "provider_trace": (res.error.trace if getattr(res, "error", None) else None),
        }

    # Success path
    if res.ok and isinstance(res.data, dict):
        parsed = res.data

        now_local = datetime.now(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = now_local.isoformat()

        # reálny model z providera (gpt-... / gemini-...)
        parsed["model"] = str(getattr(res, "model", None) or model or "Trainalyze Coach")

        plan_meta = parsed.get("plan_meta")
        if not isinstance(plan_meta, dict):
            plan_meta = {}

        # FORCE: weeks must match horizon_weeks (always)
        plan_meta["weeks"] = int(horizon_weeks)
        parsed["plan_meta"] = plan_meta

        return parsed, trace

    # Fallback (keď provider zlyhá alebo vráti zlý formát)
    now_iso = datetime.now(tzinfo).isoformat()

    prefs_fb = ctx.get("prefs") or {}
    if isinstance(prefs_fb, dict) and isinstance(prefs_fb.get("value"), dict):
        prefs_fb = prefs_fb["value"]

    fallback = {
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
        "error": (res.error.message if getattr(res, "error", None) else "AI provider failed"),
        "error_code": (res.error.code if getattr(res, "error", None) else "ai_failed"),
        "provider": getattr(res, "provider", None),
        "provider_model": getattr(res, "model", None),
    }

    return fallback, trace