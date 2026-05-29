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


# ============================================================
# HELPERS
# ============================================================

def _get_trace(res: Any) -> Dict[str, Any]:
    """
    Vytiahne trace z AI result — zachováva ok_provider a ok_model z providera.
    NEPREPÍSUJE ich — provider ich už správne nastavil.
    """
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
    """Bezpečne načíta user settings."""
    if not user_id:
        return {}
    try:
        return service_load_user_settings(ctx=ctx, user_id=user_id) or {}
    except Exception:
        return {}


def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    """Vráti timezone objekt z nastavení, fallback Bratislava."""
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def generate_weekly_plan_json(
    context_payload: dict,
    ctx: AuthCtx,
    model: Optional[str] = None,
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """
    Generuje weekly meta-plán (objemy, fázy, ciele) na niekoľko týždňov.
    model=None = provider použije default z ENV.
    Vracia (data, trace, error_message).
    """
    context: Dict[str, Any] = (
        context_payload if isinstance(context_payload, dict) else {}
    )

    # User ID a settings
    user_id: Optional[int] = None
    try:
        uid = context.get("user_id")
        user_id = int(uid) if uid is not None else None
    except Exception:
        pass

    settings = _load_settings(user_id, ctx)
    tzinfo = _tzinfo_from_settings(settings)

    # Prompty
    system_txt, user_txt = build_prompts_for_weekly(context, settings=settings)

    # Parametre
    resolved_max_tokens = int(
        max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 4000)
    )
    resolved_temperature = float(
        temperature if temperature is not None else (LLM_TEMPERATURE or 0.2)
    )

    try:
        horizon_weeks = int(context.get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    # AI volanie — provider rieši fallbacky
    res = ai_call_json_model(
        context_payload=context,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
    )

    # Trace — NEZAPISUJEME cez update() aby sme neprepísali ok_provider/ok_model
    trace = _get_trace(res)
    trace["max_tokens"] = resolved_max_tokens
    trace["temperature"] = resolved_temperature
    trace["timezone"] = str(settings.get("timezone") or "Europe/Bratislava")

    if res.ok and isinstance(res.data, dict):
        parsed: Dict[str, Any] = dict(res.data)
        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = datetime.now(tzinfo).isoformat()
        parsed["model"] = str(res.model or model or "unknown")

        plan_meta = parsed.get("plan_meta") or {}
        if not isinstance(plan_meta, dict):
            plan_meta = {}
        plan_meta["weeks"] = horizon_weeks
        parsed["plan_meta"] = plan_meta

        return parsed, trace, None

    # Zlyhanie
    err_msg = (
        res.error.message if res.error else "AI provider failed after all fallback attempts"
    )
    trace["error_code"] = res.error.code if res.error else "ai_failed"
    trace["error_message"] = err_msg

    return None, trace, err_msg