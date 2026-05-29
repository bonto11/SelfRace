# Services/AI/activity_review/generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Services.user_prefs import service_load_user_settings
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.activity_review.prompts import build_prompts_for_activity_review
from Modules.Supabase.auth import AuthCtx


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


def _safe_activity_id(context_payload: Dict[str, Any]) -> Optional[int]:
    """Bezpečne vytiahne activity_id z context_payload."""
    try:
        act = context_payload.get("activity")
        if not isinstance(act, dict):
            return None
        v = act.get("activity_id")
        return int(v) if v is not None else None
    except Exception:
        return None


def _safe_root_sport(context_payload: Dict[str, Any]) -> str:
    """Vytiahne sport z root alebo activity bloku, fallback 'other'."""
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
    """Detekuje race/test session z flags alebo názvu aktivity."""
    try:
        ui = context_payload.get("user_input") or {}
        if ui.get("is_race_effort") is True:
            return True
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
            if any(x in n for x in ["race", "závod", "pretek", "preteky"]):
                return True
        return False
    except Exception:
        return False


def _has_active_injury(context_payload: Dict[str, Any]) -> bool:
    """
    Kontroluje či má používateľ aktívne zranenie v context.injury_state.
    Správny kľúč je context.injury_state (nie user_input.injury).
    """
    try:
        ctx_block = context_payload.get("context") or {}
        injury_state = ctx_block.get("injury_state")
        if not injury_state:
            return False
        # injury_state môže byť dict s active_injuries alebo priamo bool
        if isinstance(injury_state, dict):
            injuries = injury_state.get("active_injuries")
            return bool(injuries and len(injuries) > 0)
        return bool(injury_state)
    except Exception:
        return False


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


def _extract_user_input(
    context_payload: Dict[str, Any],
) -> Tuple[Optional[str], Optional[str]]:
    """Vytiahne comment a source z user_input bloku."""
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


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def generate_activity_review_json(
    *,
    context_payload: Dict[str, Any],
    ctx: AuthCtx,
    model: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Orchestruje generovanie AI review pre jednu aktivitu.
    Vracia trojicu (data, trace, error_message).
    data je None ak AI zlyhalo aj po fallbackoch.
    trace vždy obsahuje ok_provider a ok_model pre billing a debug.
    """
    # Nastavenia užívateľa (timezone, jazyk)
    settings: Dict[str, Any] = {}
    if user_id is not None:
        try:
            settings = service_load_user_settings(user_id=int(user_id), ctx=ctx) or {}
        except Exception as e:
            print("[AR][generate] settings load error:", repr(e))

    tzinfo = _tzinfo_from_settings(settings)
    user_comment, user_source = _extract_user_input(context_payload)
    has_injury = _has_active_injury(context_payload)

    sport = _safe_root_sport(context_payload)
    is_race = _safe_is_race(context_payload)

    # Zostavenie promptov
    system_txt, user_txt = build_prompts_for_activity_review(
        context_payload=context_payload,
        settings=settings,
        sport=sport,
        is_race=is_race,
    )

    # Volanie AI providera — provider sám rieši fallbacky (haiku → sonnet → openai...)
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,  # None = provider použije default z ENV
    )
    
    from Services.AI.utils.others import debug_log_ai_io
    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, _get_trace_from_result(res))


    trace = _get_trace_from_result(res)

    if res.ok and isinstance(res.data, dict):
        parsed = dict(res.data)
        parsed.setdefault("schema_version", 6)
        parsed.setdefault("generated_at", _now_local_iso(tzinfo))

        # Zaznamená reálny model ktorý odpovedal (môže byť fallback)
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

    # AI zlyhalo aj po všetkých fallbackoch
    error_msg = res.error.message if res.error else "AI fallback system failed"
    return None, trace, error_msg