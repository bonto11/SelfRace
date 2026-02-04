# Routes_AI/activity_review_generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple, Mapping

from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.AI.provider import ai_call_json_model
from Routes_AI.activity_review_prompts import build_prompts_for_activity_review

def _as_dict_str_any(x: Any) -> Dict[str, Any]:
    # už je to dict so string keymi
    if isinstance(x, dict):
        out: Dict[str, Any] = {}
        for k, v in x.items():
            # key môže byť bytes/čokoľvek
            if isinstance(k, bytes):
                kk = k.decode("utf-8", errors="ignore")
            else:
                kk = str(k)
            out[kk] = v
        return out

    # mapping-like (napr. pydantic / custom)
    if isinstance(x, Mapping):
        return {str(k): v for k, v in x.items()}

    return {}

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


def _to_int_safe(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        # str() kvôli "123" aj kvôli Any
        return int(str(v))
    except Exception:
        return None


def _safe_activity_id(context_payload: dict[str, Any]) -> Optional[int]:
    act = context_payload.get("activity")
    if not isinstance(act, dict):
        return None
    return _to_int_safe(act.get("activity_id"))


def _safe_user_id(context_payload: dict[str, Any]) -> Optional[int]:
    u = context_payload.get("user")
    if not isinstance(u, dict):
        return None
    return _to_int_safe(u.get("id"))


def _trace_base(
    *,
    provider: str,
    model: str,
    debug_raw: bool,
    ai_debug_trace: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    t: Dict[str, Any] = {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": {},
        "ok_model": model,
    }

    if isinstance(ai_debug_trace, dict):
        mt = ai_debug_trace.get("models_tried")
        at = ai_debug_trace.get("attempts")
        if isinstance(mt, list):
            t["models_tried"] = mt
        if isinstance(at, list):
            t["attempts"] = at

        u = ai_debug_trace.get("usage")
        if isinstance(u, dict):
            t["usage"] = u

        if debug_raw:
            if "raw" in ai_debug_trace:
                t["raw"] = ai_debug_trace.get("raw")
            if "cleaned" in ai_debug_trace:
                t["cleaned"] = ai_debug_trace.get("cleaned")

    if debug_raw and error:
        t["error"] = error

    return t


def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    model: str,
    user_id: Optional[int] = None,
    debug_raw: bool = False,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    Provider-agnostic generator for Activity Review.
    Prompt text + schema must live in prompts.
    """

    # infer user_id if not provided
    uid = _safe_user_id(context_payload)

    # --- user settings (language, timezone) ---
    settings: Dict[str, Any] = {}
    if uid is not None:
        try:
            settings = service_load_user_settings(int(uid)) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)
    lang = _lang_from_settings(settings)

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
        model=str(model),
        debug_raw=bool(debug_raw),
    )

    # --- SUCCESS ---
    if getattr(res, "ok", False):
        parsed: Dict[str, Any] = _as_dict_str_any(getattr(res, "data", None))

        if parsed:
            parsed.setdefault("schema_version", 1)
            parsed.setdefault("generated_at", _now_local_iso(tzinfo))
            parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)
            parsed.setdefault("activity_id", _safe_activity_id(context_payload))

            trace = None
            if debug_raw:
                ai_tr = getattr(getattr(res, "error", None), "trace", None)
                trace = _trace_base(
                    provider=str(getattr(res, "provider", None) or "unknown"),
                    model=str(getattr(res, "model", None) or model),
                    debug_raw=True,
                    ai_debug_trace=(ai_tr if isinstance(ai_tr, dict) else None),
                )

            return parsed, trace

    # --- FAILURE / FALLBACK ---
    err_msg: Optional[str] = None
    try:
        err_msg = getattr(getattr(res, "error", None), "message", None)
    except Exception:
        err_msg = None

    fallback_copy = _fallback_copy(lang)
    fallback: Dict[str, Any] = {
        "schema_version": 1,
        "generated_at": _now_local_iso(tzinfo),
        "model": "activity-review-fallback",
        "summary": fallback_copy,
        "activity_id": _safe_activity_id(context_payload),
        "error": err_msg or "AI provider call failed",
    }

    trace = None
    if debug_raw:
        ai_tr = getattr(getattr(res, "error", None), "trace", None)
        trace = _trace_base(
            provider=str(getattr(res, "provider", None) or "unknown"),
            model=str(getattr(res, "model", None) or model),
            debug_raw=True,
            ai_debug_trace=(ai_tr if isinstance(ai_tr, dict) else None),
            error=(err_msg or "AI provider call failed"),
        )

    return fallback, trace