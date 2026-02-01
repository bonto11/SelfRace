# Routes_AI/weekly_plan_generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Services.user_prefs import service_load_user_settings
from Routes_AI.weekly_plan_prompts import build_prompts_for_weekly

from Services.AI.provider import ai_call_json_model


def generate_weekly_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Provider-agnostic weekly plan generator.
    - používa Services.AI.provider.ai_call_json_model()
    - neobsahuje žiadne OpenAI importy ani token budget logiku
    - vracia (weekly_plan_dict, trace_or_None)
    """

    # authoritative user_id is always context_payload.user_id
    user_id: Optional[int] = None
    try:
        if isinstance(context_payload, dict) and context_payload.get("user_id") is not None:
            user_id = int(context_payload["user_id"])
    except Exception:
        user_id = None

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    system_txt, user_txt = build_prompts_for_weekly(
        context_payload,
        settings=settings,
    )

    # authoritative weeks horizon
    horizon_weeks: int = 6
    try:
        horizon_weeks = int((context_payload or {}).get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    tz_name = (settings.get("timezone") or "Europe/Bratislava") if isinstance(settings, dict) else "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    # Provider call (OpenAI/Gemini)
    res = ai_call_json_model(
        context_payload=context_payload if isinstance(context_payload, dict) else {},
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        debug_raw=debug_raw,
        # max_tokens/temperature berie provider/client z env defaultov,
        # ale ponechávame parametre aby si to vedel override-núť z call site neskôr.
    )

    trace: Optional[dict] = None
    if debug_raw:
        trace = {
            "ok": bool(res.ok),
            "provider": getattr(res, "provider", None),
            "model": getattr(res, "model", None),
            "error": (res.error.message if getattr(res, "error", None) else None),
            "error_code": (res.error.code if getattr(res, "error", None) else None),
            "provider_trace": (res.error.trace if getattr(res, "error", None) else None),
        }

    # Success path
    if res.ok and isinstance(res.data, dict):
        parsed = res.data

        now_local = datetime.now(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = now_local.isoformat()
        # model = reálny model z providera (napr. gpt-4o-mini / gemini-1.5-flash-latest)
        parsed["model"] = str(getattr(res, "model", None) or model or "Trainalyze Coach")

        plan_meta = parsed.get("plan_meta") or {}
        if not isinstance(plan_meta, dict):
            plan_meta = {}

        # FORCE: weeks must match horizon_weeks (always)
        plan_meta["weeks"] = horizon_weeks
        parsed["plan_meta"] = plan_meta

        return parsed, trace

    # Fallback (keď provider zlyhá alebo vráti zlý formát)
    now_iso = datetime.now(tzinfo).isoformat()

    prefs_fb = (context_payload or {}).get("prefs") or {}
    if isinstance(prefs_fb, dict) and isinstance(prefs_fb.get("value"), dict):
        prefs_fb = prefs_fb["value"]

    # minimal safe fallback schema
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
            "weeks": horizon_weeks,
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