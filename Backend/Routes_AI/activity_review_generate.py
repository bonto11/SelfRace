# Routes_AI/activity_review_generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.AI.provider import ai_call_json_model
from Routes_AI.activity_review_prompts import build_prompts_for_activity_review
from Modules.Supabase.auth import AuthCtx

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
        return {"headline": "We couldn't generate the activity review.", "bullets": ["Please try again later."]}
    if lang == "cs":
        return {"headline": "Nepodařilo se získat hodnocení aktivity.", "bullets": ["Zkuste to později."]}
    return {"headline": "Nepodarilo sa získať AI hodnotenie aktivity.", "bullets": ["Skús to znova neskôr."]}

def _safe_activity_id(context_payload: Dict[str, Any]) -> Optional[int]:
    try:
        act = context_payload.get("activity")
        if not isinstance(act, dict):
            return None
        v = act.get("activity_id")
        return int(v) if v is not None else None
    except Exception:
        return None

def _safe_root_sport(context_payload: Dict[str, Any]) -> str:
    try:
        s = context_payload.get("sport")
        if isinstance(s, str) and s.strip():
            return s.strip()
        act = context_payload.get("activity")
        if isinstance(act, dict):
            s2 = act.get("sport")
            if isinstance(s2, str) and s2.strip():
                return s2.strip()
        return "other"
    except Exception:
        return "other"

def _safe_is_race(context_payload: Dict[str, Any]) -> bool:
    try:
        act = context_payload.get("activity")
        if not isinstance(act, dict):
            return False
        flags = act.get("flags")
        if isinstance(flags, dict) and flags.get("is_race") is True:
            return True
        name = None
        m = act.get("metrics")
        if isinstance(m, dict):
            name = m.get("name") or m.get("title")
        if name is None:
            name = act.get("name")
        if isinstance(name, str):
            n = name.lower()
            if ("race" in n) or ("závod" in n) or ("pretek" in n) or ("preteky" in n):
                return True
        return False
    except Exception:
        return False

def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    err = getattr(res, "error", None)
    tr2 = getattr(err, "trace", None) if err is not None else None
    if isinstance(tr2, dict):
        return tr2
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "models_tried": [],
        "attempts": [],
        "usage": None,
        "ok_model": str(getattr(res, "model", None) or "") or None,
    }

def _extract_user_input(context_payload: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    try:
        ui = context_payload.get("user_input")
        if not isinstance(ui, dict):
            return None, None
        c = ui.get("comment")
        s = ui.get("source")
        comment = str(c).strip() if isinstance(c, str) and c.strip() else None
        source = str(s).strip().lower() if isinstance(s, str) and s.strip() else None
        return comment, source
    except Exception:
        return None, None

def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    model: str,
    user_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:

    settings: Dict[str, Any] = {}
    if user_id is not None:
        try:
            settings = service_load_user_settings(user_id=int(user_id), ctx=ctx) or {}
        except Exception as e:
            print("[AR][generate] settings load error:", repr(e))
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)
    lang = _lang_from_settings(settings)

    user_comment, user_source = _extract_user_input(context_payload)

    # Detekcia, či ide zranenie ďalej
    ui_block = context_payload.get("user_input") or {}
    has_injury = bool(ui_block.get("injury"))

    sport = _safe_root_sport(context_payload)
    is_race = _safe_is_race(context_payload)

    system_txt, user_txt = build_prompts_for_activity_review(
        context_payload=context_payload,
        settings=settings,
        sport=sport,
        is_race=is_race,
    )

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=str(model),
    )

    trace = _get_trace_from_result(res)

    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(getattr(res, "data") or {})

        parsed.setdefault("schema_version", 6)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))

        ok_model = str(getattr(res, "model", None) or model)
        parsed["model"] = str(parsed.get("model") or ok_model)

        parsed.setdefault("activity_id", _safe_activity_id(context_payload))
        parsed.setdefault("sport", sport or "other")

        parsed.setdefault("meta", {})
        if isinstance(parsed["meta"], dict):
            parsed["meta"]["user_comment_present"] = bool(user_comment)
            parsed["meta"]["injury_reported"] = has_injury
            parsed["meta"]["source"] = user_source or None

        if isinstance(trace, dict) and not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace

    err_msg: Optional[str] = None
    try:
        err_msg = getattr(getattr(res, "error", None), "message", None)
    except Exception:
        err_msg = None

    fallback: Dict[str, Any] = {
        "schema_version": 6,
        "generated_at": _now_local_iso(tzinfo),
        "model": "activity-review-fallback",
        "activity_id": _safe_activity_id(context_payload),
        "sport": sport or "other",
        "summary": _fallback_copy(lang),
        "error": err_msg or "AI provider call failed",
        "meta": {
            "user_comment_present": bool(user_comment),
            "injury_reported": has_injury,
            "source": user_source or None,
        },
    }

    return fallback, trace
