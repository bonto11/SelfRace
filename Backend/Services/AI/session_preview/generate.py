# Services/AI/session_preview/generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.session_preview.prompts import build_prompts_for_session_preview
from Modules.Supabase.auth import AuthCtx
from Services.AI.utils.others import debug_log_ai_io


# ============================================================
# HELPERS
# ============================================================

def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    """Vráti timezone objekt z nastavení užívateľa, fallback na UTC."""
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    """Vráti aktuálny čas v lokálnej zóne ako ISO string."""
    return datetime.now(tzinfo).isoformat()


def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """Vytiahne trace dict z AI result objektu."""
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
        "ok_provider": str(getattr(res, "provider", None) or "unknown"),
    }


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def generate_session_preview_json(
    *,
    context_payload: Dict[str, Any],
    ctx: AuthCtx,
    model: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Orchestruje generovanie AI odpovede pre jednu naplánovanú session.
    Vracia trojicu (data, trace, error_message).
    data je None ak AI zlyhalo aj po fallbackoch.
    trace vždy obsahuje ok_provider a ok_model pre billing a debug.
    """
    settings: Dict[str, Any] = {}
    if user_id is not None:
        try:
            settings = service_load_user_settings(user_id=int(user_id), ctx=ctx) or {}
        except Exception as e:
            print("[SP][generate] settings load error:", repr(e))

    tzinfo = _tzinfo_from_settings(settings)

    system_txt, user_txt = build_prompts_for_session_preview(
        context_payload=context_payload,
        settings=settings,
    )

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,  # None = provider použije default z ENV
    )

    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, _get_trace_from_result(res))

    trace = _get_trace_from_result(res)

    if res.ok and isinstance(res.data, dict):
        parsed = dict(res.data)
        parsed.setdefault("schema_version", 1)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))

        ok_model = str(res.model or model or "unknown")
        parsed["model"] = str(parsed.get("model") or ok_model)

        return parsed, trace, None

    error_msg = res.error.message if res.error else "AI fallback system failed"
    return None, trace, error_msg
