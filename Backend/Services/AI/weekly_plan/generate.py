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

def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """
    Vytiahne trace dáta z výsledku AI volania.
    Provider teraz vracia detailné informácie o všetkých pokusoch.
    """
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    
    # Základný fallback pre štruktúru trace
    err = getattr(res, "error", None)
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
        "models_tried": [],
        "attempts": [],
        "error": getattr(err, "message", None) if err else None
    }

def generate_weekly_plan_json(
    context_payload: dict,
    ctx: AuthCtx,
    model: Optional[str] = None, # ZMENA: Model je teraz voliteľný
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """
    Generuje makro-cyklus (dlhodobý plán) na niekoľko týždňov.
    Využíva centrálnu logiku fallbackov v provider.py.
    """
    context: Dict[str, Any] = (
        context_payload if isinstance(context_payload, dict) else {}
    )

    user_id: Optional[int] = None
    try:
        uid = context.get("user_id")
        user_id = int(uid) if uid is not None else None
    except Exception:
        pass

    # Načítanie preferencií používateľa
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(ctx=ctx, user_id=int(user_id)) or {}
        except Exception:
            pass

    # Zostavenie systémového a používateľského promptu
    system_txt, user_txt = build_prompts_for_weekly(context, settings=settings)

    try:
        horizon_weeks = int(context.get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    # Určenie časovej zóny pre správny timestamp generovania
    tz_name = settings.get("timezone") or "Europe/Bratislava"
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

    # Hlavné volanie AI. Ak model zlyhá, provider skúsi fallbacky z configu.
    res = ai_call_json_model(
        context_payload=context,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
    )

    # Získanie trace dát (obsahujú info o tom, či sme museli použiť fallback)
    trace: Dict[str, Any] = _get_trace_from_result(res)
    trace.update({
        "max_tokens": resolved_max_tokens,
        "temperature": resolved_temperature,
        "timezone": str(tz_name),
        "ok": bool(res.ok)
    })

    # --- Cesta úspechu ---
    if res.ok and isinstance(res.data, dict):
        parsed: Dict[str, Any] = dict(res.data)

        now_local = datetime.now(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = now_local.isoformat()
        
        # Zapíšeme model, ktorý reálne odpovedal (mohol to byť fallback)
        ok_model = str(res.model or model or "unknown")
        parsed["model"] = str(parsed.get("model") or ok_model)

        plan_meta = parsed.get("plan_meta")
        if not isinstance(plan_meta, dict):
            plan_meta = {}

        plan_meta["weeks"] = int(horizon_weeks)
        parsed["plan_meta"] = plan_meta

        if not trace.get("ok_model"):
            trace["ok_model"] = parsed["model"]

        return parsed, trace, None

    # --- Cesta zlyhania (všetky modely v reťazci zlyhali) ---
    err_msg = res.error.message if res.error else "AI provider failed after all fallback attempts"
    
    trace["error_code"] = res.error.code if res.error else "ai_failed"
    trace["error_message"] = err_msg

    return None, trace, err_msg
