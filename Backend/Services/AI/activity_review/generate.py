# Services/AI/activity_review/generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.activity_review.prompts import build_prompts_for_activity_review
from Modules.Supabase.auth import AuthCtx

def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc

def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    return datetime.now(tzinfo).isoformat()

def _safe_activity_id(context_payload: Dict[str, Any]) -> Optional[int]:
    try:
        act = context_payload.get("activity")
        if not isinstance(act, dict): return None
        v = act.get("activity_id")
        return int(v) if v is not None else None
    except Exception: return None

def _safe_root_sport(context_payload: Dict[str, Any]) -> str:
    try:
        s = context_payload.get("sport")
        if isinstance(s, str) and s.strip(): return s.strip()
        act = context_payload.get("activity")
        if isinstance(act, dict):
            s2 = act.get("sport")
            if isinstance(s2, str) and s2.strip(): return s2.strip()
        return "other"
    except Exception: return "other"

def _safe_is_race(context_payload: Dict[str, Any]) -> bool:
    try:
        act = context_payload.get("activity")
        if not isinstance(act, dict): return False
        flags = act.get("flags")
        if isinstance(flags, dict) and flags.get("is_race") is True: return True
        name = None
        m = act.get("metrics")
        if isinstance(m, dict): name = m.get("name") or m.get("title")
        if name is None: name = act.get("name")
        if isinstance(name, str):
            n = name.lower()
            if any(x in n for x in ["race", "závod", "pretek", "preteky"]): return True
        return False
    except Exception: return False

def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """Pomocná funkcia na vytiahnutie trace dát z výsledku AI."""
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict): return tr
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
    }

def _extract_user_input(context_payload: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    try:
        ui = context_payload.get("user_input")
        if not isinstance(ui, dict): return None, None
        c, s = ui.get("comment"), ui.get("source")
        comment = str(c).strip() if isinstance(c, str) and c.strip() else None
        source = str(s).strip().lower() if isinstance(s, str) and s.strip() else None
        return comment, source
    except Exception: return None, None

def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    model: Optional[str] = None, # Teraz voliteľné, provider použije fallbacky
    user_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Hlavná funkcia na generovanie review. 
    Vracia (data, trace, error_message).
    """
    settings: Dict[str, Any] = {}
    if user_id is not None:
        try:
            settings = service_load_user_settings(user_id=int(user_id), ctx=ctx) or {}
        except Exception as e:
            print("[AR][generate] settings load error:", repr(e))

    tzinfo = _tzinfo_from_settings(settings)
    user_comment, user_source = _extract_user_input(context_payload)
    ui_block = context_payload.get("user_input") or {}
    has_injury = bool(ui_block.get("injury"))

    sport = _safe_root_sport(context_payload)
    is_race = _safe_is_race(context_payload)

    # Zostavenie promptov
    system_txt, user_txt = build_prompts_for_activity_review(
        context_payload=context_payload,
        settings=settings,
        sport=sport,
        is_race=is_race,
    )

    # Volanie providera (ten už sám rieši fallbacky)
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
    )

    trace = _get_trace_from_result(res)

    if res.ok and isinstance(res.data, dict):
        parsed = dict(res.data)
        parsed.setdefault("schema_version", 6)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))

        # Zapíšeme model, ktorý reálne odpovedal (mohol to byť fallback)
        ok_model = str(res.model or model or "unknown")
        parsed["model"] = str(parsed.get("model") or ok_model)

        parsed.setdefault("activity_id", _safe_activity_id(context_payload))
        parsed.setdefault("sport", sport or "other")

        parsed.setdefault("meta", {})
        if isinstance(parsed["meta"], dict):
            parsed["meta"]["user_comment_present"] = bool(user_comment)
            parsed["meta"]["injury_reported"] = has_injury
            parsed["meta"]["source"] = user_source or None

        return parsed, trace, None

    # Ak všetko zlyhalo (aj fallbacky)
    error_msg = res.error.message if res.error else "AI fallback system failed"
    return None, trace, error_msg
