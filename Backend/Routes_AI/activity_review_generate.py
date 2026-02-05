# Routes_AI/activity_review_generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.users import require_jwt
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
        return int(v) if v is not None else None
    except Exception:
        return None


def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """
    ✅ vždy vráť aspoň minimálny trace
    Preferuj res.trace (nové), fallback na res.error.trace (staré).
    """
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


def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    model: str,
    user_id: Optional[int] = None,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    IMPORTANT:
    - Keď service=True (job/worker), NESMIE vyžadovať Authorization JWT.
    - Keď service=False (FE), JWT je povinný.
    """
    print("[AR][generate_activity_review_json] user_id", user_id, "service", service)

    # JWT routing: FE -> require_jwt, worker -> None/forward
    jwt = user_jwt if service else require_jwt(user_jwt)

    settings: Dict[str, Any] = {}
    if user_id is not None:
        try:
            # musí podporovať service=True (service client) bez JWT
            settings = (
                service_load_user_settings(
                    int(user_id),
                    user_jwt=jwt,
                    service=service,
                )
                or {}
            )
        except Exception as e:  # noqa: BLE001
            print("[AR][generate] settings load error", repr(e))
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)
    lang = _lang_from_settings(settings)

    system_txt, user_txt = build_prompts_for_activity_review(
        context_payload=context_payload,
        settings=settings,
    )

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=str(model),
    )

    trace = _get_trace_from_result(res)

    # success
    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(getattr(res, "data") or {})
        parsed.setdefault("schema_version", 1)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))

        ok_model = str(getattr(res, "model", None) or model)
        parsed["model"] = str(parsed.get("model") or ok_model)
        parsed.setdefault("activity_id", _safe_activity_id(context_payload))

        if isinstance(trace, dict) and not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

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

    return fallback, trace