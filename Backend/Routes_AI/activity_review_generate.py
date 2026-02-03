# Routes_AI/activity_review_generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Optional, Tuple, Any

from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.AI.provider import ai_call_json_model
from Routes_AI.activity_review_prompts import build_prompts_for_activity_review


def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    return datetime.now(tzinfo).isoformat()


def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    model: str,
    user_id: Optional[int] = None,
    debug_raw: bool = False,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    Provider-agnostic generator pre Activity Review.
    Neobsahuje žiadny prompt text ani schema – to je výhradne v prompts.
    """

    # --- user settings (jazyk, timezone) ---
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)

    # --- PROMPTS ---
    system_txt, user_txt = build_prompts_for_activity_review(
        context_payload=context_payload,
        settings=settings,
    )

    # --- AI CALL ---
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        debug_raw=debug_raw,
    )

    # --- SUCCESS ---
    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(res.data)

        parsed.setdefault("schema_version", 1)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))
        parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)

        trace = None
        if debug_raw:
            trace = {
                "provider": getattr(res, "provider", None),
                "model": getattr(res, "model", None),
                "trace": getattr(getattr(res, "error", None), "trace", None),
            }

        return parsed, trace

    # --- FAILURE / FALLBACK ---
    err_msg = None
    try:
        err_msg = getattr(getattr(res, "error", None), "message", None)
    except Exception:
        pass

    fallback = {
        "schema_version": 1,
        "generated_at": _now_local_iso(tzinfo),
        "model": "activity-review-fallback",
        "summary": {
            "headline": "Nepodarilo sa získať AI hodnotenie aktivity.",
            "bullets": ["Skús to znova neskôr."],
        },
        "activity_id": context_payload.get("activity", {}).get("activity_id"),
        "error": err_msg or "AI provider call failed",
    }

    trace = None
    if debug_raw:
        trace = {
            "provider": getattr(res, "provider", None),
            "model": getattr(res, "model", None),
            "error": err_msg,
        }

    return fallback, trace