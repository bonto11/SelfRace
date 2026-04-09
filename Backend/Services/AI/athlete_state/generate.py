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


def _safe_user_id_from_context(context_payload: dict) -> Optional[int]:
    """Bezpečne vytiahne user_id z payloadu."""
    try:
        v = context_payload.get("user_id")
        return int(v) if v is not None else None
    except Exception:
        return None


def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    """Zistí časovú zónu používateľa."""
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    """Vráti aktuálny čas v ISO formáte pre danú zónu."""
    return datetime.now(tzinfo).isoformat()


def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """
    Vytiahne trace informácie z výsledku.
    Keďže provider.py už trace plní komplexne, tu ho len skopírujeme.
    """
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    
    # Fallback ak trace neexistuje
    err = getattr(res, "error", None)
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
        "error": getattr(err, "message", None) if err else None
    }


def generate_athlete_state_json(
    context_payload: dict,
    ctx: AuthCtx,
    model: Optional[str] = None, # ZMENA: model je teraz voliteľný
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """Generuje analýzu aktuálneho stavu športovca."""

    user_id = _safe_user_id_from_context(context_payload)
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
        except Exception:
            pass

    tzinfo = _tzinfo_from_settings(settings)
    system_txt, user_txt = build_prompts_for_analyze(
        context_payload, settings=settings, ctx=ctx
    )

    # Voláme providera, ktorý vnútri točí model_chain (fallbacky)
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
    )
 
    trace = _get_trace_from_result(res)

    if res.ok and isinstance(res.data, dict):
        parsed: Dict[str, Any] = dict(res.data)
        parsed["schema_version"] = 1
        parsed["generated_at"] = _now_local_iso(tzinfo)
        # Zapíšeme model, ktorý reálne odpovedal
        parsed["model"] = str(res.model or model or "unknown")

        if not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace, None

    # V prípade totálneho zlyhania
    err_msg = getattr(res.error, "message", None) if res.error else "AI provider call failed"
    return None, trace, err_msg


def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: Optional[str] = None, # ZMENA: model je teraz voliteľný
    user_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """Generuje report o pokroku medzi dvoma stavmi."""

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
        except Exception:
            pass

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

    trace = _get_trace_from_result(res)

    if res.ok and isinstance(res.data, dict):
        parsed: Dict[str, Any] = dict(res.data)
        parsed["schema_version"] = 1
        parsed["generated_at"] = _now_local_iso(tzinfo)
        parsed["model"] = str(res.model or model or "unknown")

        if not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace, None

    # V prípade totálneho zlyhania
    err_msg = getattr(res.error, "message", None) if res.error else "AI provider call failed"
    return None, trace, err_msg
