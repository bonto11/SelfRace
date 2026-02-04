from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

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


def _lang_from_settings(settings: Dict[str, Any]) -> str:
    v = (settings.get("language") or "sk").strip().lower()
    if v.startswith("en"):
        return "en"
    if v.startswith("cs"):
        return "cs"
    return "sk"


def _fallback_copy(lang: str) -> Dict[str, Any]:
    if lang == "en":
        return {"headline": "We couldn't generate the activity review.", "bullets": ["Try again later."]}
    if lang == "cs":
        return {"headline": "Nepodařilo se získat hodnocení aktivity.", "bullets": ["Zkus to později."]}
    return {"headline": "Nepodarilo sa získať AI hodnotenie aktivity.", "bullets": ["Skús to znova neskôr."]}


def _safe_activity_id(context_payload: Dict[str, Any]) -> Optional[int]:
    try:
        act = context_payload.get("activity")
        if not isinstance(act, dict):
            return None
        v = act.get("activity_id")
        if v is None:
            return None
        return int(v)
    except Exception:
        return None


def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    model: str,
    user_id: Optional[int] = None,
    debug_raw: bool = True,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    print("[AR][generate] start", {"model": model, "user_id": user_id, "activity_id": _safe_activity_id(context_payload)})

    # settings
    settings: Dict[str, Any] = {}
    if user_id is not None:
        try:
            settings = service_load_user_settings(int(user_id)) or {}
        except Exception as e:
            print("[AR][generate] settings load error", repr(e))
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)
    lang = _lang_from_settings(settings)

    system_txt, user_txt = build_prompts_for_activity_review(context_payload=context_payload, settings=settings)
    print("[AR][generate] prompts_len", {"system": len(system_txt or ""), "user": len(user_txt or "")})

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=str(model),
        debug_raw=bool(debug_raw),
    )

    print("[AR][generate] provider_result", {
        "ok": bool(getattr(res, "ok", False)),
        "provider": getattr(res, "provider", None),
        "model": getattr(res, "model", None),
        "data_type": type(getattr(res, "data", None)).__name__,
    })

    # success
    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(getattr(res, "data") or {})
        parsed.setdefault("schema_version", 1)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))
        parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)
        parsed.setdefault("activity_id", _safe_activity_id(context_payload))

        trace = None
        if debug_raw:
            ai_tr = getattr(getattr(res, "error", None), "trace", None)
            trace = ai_tr if isinstance(ai_tr, dict) else None

        return parsed, trace

    # failure
    err_msg: Optional[str] = None
    try:
        err_msg = getattr(getattr(res, "error", None), "message", None)
    except Exception:
        err_msg = None

    fallback: Dict[str, Any] = {
        "schema_version": 1,
        "generated_at": _now_local_iso(tzinfo),
        "model": "activity-review-fallback",
        "summary": _fallback_copy(lang),
        "activity_id": _safe_activity_id(context_payload),
        "error": err_msg or "AI provider call failed",
    }

    trace = None
    if debug_raw:
        ai_tr = getattr(getattr(res, "error", None), "trace", None)
        trace = ai_tr if isinstance(ai_tr, dict) else None

    print("[AR][generate] fallback", {"error": fallback.get("error")})
    return fallback, trace