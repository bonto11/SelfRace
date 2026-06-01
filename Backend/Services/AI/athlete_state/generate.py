# Services/AI/athlete_state/generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Services.user_prefs import service_load_user_settings
from Services.AI.athlete_state.prompts import (
    build_prompts_for_analyze,
    build_prompts_for_progress,
)
from Services.AI.provider.provider import ai_call_json_model
from Modules.Supabase.auth import AuthCtx
from Services.AI.utils.others import debug_log_ai_io


# ============================================================
# HELPERS
# ============================================================

def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    """Vráti timezone objekt z nastavení, fallback na Bratislavu."""
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    """Aktuálny čas v lokálnej zóne ako ISO string."""
    return datetime.now(tzinfo).isoformat()


def _get_trace(res: Any) -> Dict[str, Any]:
    """Vytiahne trace z AI result — vždy vracia dict s ok_provider a ok_model."""
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    err = getattr(res, "error", None)
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
        "error": getattr(err, "message", None) if err else None,
    }


def _load_settings(user_id: Optional[int], ctx: AuthCtx) -> Dict[str, Any]:
    """Bezpečne načíta user settings — prázdny dict ak zlyhá."""
    if not user_id:
        return {}
    try:
        return service_load_user_settings(ctx=ctx, user_id=user_id) or {}
    except Exception:
        return {}


# ============================================================
# GENERATE ATHLETE STATE
# ============================================================

def generate_athlete_state_json(
    context_payload: dict,
    ctx: AuthCtx,
    model: Optional[str] = None,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """
    Generuje analýzu aktuálneho stavu športovca.
    model=None = provider použije default z ENV.
    Vracia (data, trace, error_message).
    """
    user_id = _to_optional_int(context_payload.get("user_id"))
    settings = _load_settings(user_id, ctx)
    tzinfo = _tzinfo_from_settings(settings)

    system_txt, user_txt = build_prompts_for_analyze(
        context_payload, settings=settings, ctx=ctx
    )

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
    )
    
    from Services.AI.utils.others import debug_log_ai_io
    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, _get_trace(res))


    trace = _get_trace(res)

    if res.ok and isinstance(res.data, dict):
        parsed = dict(res.data)
        parsed["schema_version"] = 1
        parsed["generated_at"] = _now_local_iso(tzinfo)
        parsed["model"] = str(res.model or model or "unknown")
        return parsed, trace, None

    err_msg = (
        getattr(res.error, "message", None) if res.error else "AI provider call failed"
    )
    return None, trace, err_msg


# ============================================================
# GENERATE PROGRESS REPORT
# ============================================================

def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: Optional[str] = None,
    user_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """
    Generuje porovnávací report medzi dvoma stavmi.
    model=None = provider použije default z ENV.
    Vracia (data, trace, error_message).
    """
    settings = _load_settings(user_id, ctx)
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

    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, _get_trace(res))


    trace = _get_trace(res)

    if res.ok and isinstance(res.data, dict):
        parsed = dict(res.data)
        parsed["schema_version"] = 1
        parsed["generated_at"] = _now_local_iso(tzinfo)
        parsed["model"] = str(res.model or model or "unknown")
        return parsed, trace, None

    err_msg = (
        getattr(res.error, "message", None) if res.error else "AI provider call failed"
    )
    return None, trace, err_msg


# ============================================================
# HELPER
# ============================================================

def _to_optional_int(v: Any) -> Optional[int]:
    """Bezpečná konverzia na int, None ak zlyhá."""
    try:
        return int(v) if v is not None else None
    except Exception:
        return None