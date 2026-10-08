# Services/AI/advisor_review/generate.py
from __future__ import annotations

from Configs.config import ai_model_for
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Modules.Supabase.auth import AuthCtx
from Services.AI.advisor_review.prompts import build_prompts_for_advisor_review
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.utils.others import debug_log_ai_io
from Services.user_prefs import service_load_user_settings

from Services.AI.utils.weekday_text import localize_weekdays

def _tzinfo_from_settings(settings: Dict[str, Any]):
    """Vráti timezone objekt z nastavení, fallback na Bratislavu."""
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:  # noqa: BLE001
        return timezone.utc


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


def generate_advisor_review_json(
    context_payload: Dict[str, Any],
    *,
    user_id: int,
    model: Optional[str] = None,
    ctx: AuthCtx,
    audience: str = "athlete",
    reader_language: Optional[str] = None,
    athlete_name: str = "",
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Vygeneruje hodnotenie týždňa.
    model=None = provider použije default z ENV.
    Vracia (data, trace, error_message).
    """
    try:
        settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
    except Exception:  # noqa: BLE001
        settings = {}

    tzinfo = _tzinfo_from_settings(settings)

    # Živý tréner: text je pre trénera – v jeho jazyku (časová zóna ostáva atlétova)
    if reader_language:
        settings = {**settings, "language": reader_language}

    system_txt, user_txt = build_prompts_for_advisor_review(
        context_payload, settings=settings, audience=audience, athlete_name=athlete_name
    )

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model or ai_model_for("advisor_review"),
    )

    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, _get_trace(res))

    trace = _get_trace(res)

    if res.ok and isinstance(res.data, dict):
        # template_id / model nie sú text pre usera, ale skratky dní v nich nebudú
        parsed = localize_weekdays(dict(res.data), str(settings.get("language") or "sk"))
        parsed["schema_version"] = 1
        parsed["generated_at"] = datetime.now(tzinfo).isoformat()
        parsed["model"] = str(res.model or model or "unknown")
        return parsed, trace, None

    err_msg = (
        getattr(res.error, "message", None) if res.error else "AI provider call failed"
    )
    return None, trace, err_msg