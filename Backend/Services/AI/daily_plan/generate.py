# Services/AI/daily_plan/generate.py
from __future__ import annotations

from datetime import datetime, timezone, date
from typing import Any, Dict, Optional, Tuple, List
from zoneinfo import ZoneInfo

from Configs.config import LLM_MAX_TOKENS, LLM_TEMPERATURE
from Services.AI.daily_plan.prompts import build_prompts_for_daily
from Services.AI.provider.provider import ai_call_json_model
from Modules.Supabase.auth import AuthCtx

def _basic_shape_sanitize(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Zabezpečí, aby dáta mali správnu štruktúru (zoznam dní a relácií)."""
    if not isinstance(parsed, dict):
        return {}

    days = parsed.get("days")
    if not isinstance(days, list):
        parsed["days"] = []
        return parsed

    out_days: List[Dict[str, Any]] = []
    for d in days:
        if not isinstance(d, dict):
            continue
        ds = str(d.get("date") or d.get("plan_date") or "")[:10]
        if not ds:
            continue
        sessions = d.get("sessions")
        if sessions is None:
            sessions = []
        if not isinstance(sessions, list):
            sessions = []
            
        out_days.append({
            "date": ds,
            "plan_date": ds,
            "weekday": d.get("weekday"),
            "sessions": [s for s in sessions if isinstance(s, dict)]
        })

    parsed["days"] = out_days
    return parsed

def _parse_iso_date(s: Any) -> Optional[date]:
    """Pomocná funkcia na parsovanie dátumu z ISO formátu."""
    if not isinstance(s, str) or not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except Exception:
        return None

def _validate_dates_in_range(
    plan: Dict[str, Any],
    *,
    week_start: Optional[str],
    week_end: Optional[str],
) -> Tuple[bool, List[str]]:
    """Kontrola, či AI vrátilo dni, ktoré reálne patria do žiadaného týždňa."""
    ws = _parse_iso_date(week_start)
    we = _parse_iso_date(week_end)
    if not ws or not we:
        return True, []

    bad: List[str] = []
    for d in plan.get("days") or []:
        if not isinstance(d, dict):
            continue
        ds = str(d.get("date") or d.get("plan_date") or "")[:10]
        dd = _parse_iso_date(ds)
        if not dd:
            continue
        if dd < ws or dd > we:
            bad.append(ds)

    return (len(bad) == 0), bad

def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """Vytiahne trace dáta, ktoré pripravil provider.py (vrátane fallback pokusov)."""
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    
    # Základný fallback ak trace chýba
    return {
        "provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
        "models_tried": [],
        "attempts": []
    }

def generate_daily_week_json(
    context_payload: dict,
    model: Optional[str] = None, # Teraz voliteľné
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:
    """
    Generuje tréningový plán na celý týždeň.
    Využíva centrálny provider s automatickými fallbackmi.
    """
    ctx = context_payload if isinstance(context_payload, dict) else {}
    raw_settings = ctx.get("user_settings") or {}
    settings = raw_settings if isinstance(raw_settings, dict) else {}

    # Príprava promptov
    system_txt, user_txt, _, _ = build_prompts_for_daily(ctx, settings=settings)

    week = ctx.get("week") or {}
    week_index = int((week.get("week_index") or ctx.get("week_index") or 1) or 1)
    week_start = week.get("week_start") or ctx.get("week_start") or None
    week_end = week.get("week_end") or ctx.get("week_end") or None

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    resolved_max_tokens = int(max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2500))
    resolved_temperature = float(temperature if temperature is not None else (LLM_TEMPERATURE or 0.2))

    # Volanie AI cez providera (odstránený lokálny for-cyklus, rieši to provider)
    res = ai_call_json_model(
        context_payload=ctx,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        max_tokens=resolved_max_tokens,
        temperature=resolved_temperature,
    )

    trace = _get_trace_from_result(res)
    # Doplníme kontextové info do trace pre admin dashboard
    trace.update({
        "timezone": str(tz_name),
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
    })

    if res.ok and isinstance(res.data, dict):
        parsed = dict(res.data)

        now_local = datetime.now(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 2)
        parsed["generated_at"] = now_local.isoformat()
        parsed["model"] = str(res.model or model or "unknown")

        parsed.setdefault("week_index", week_index)
        if week_start: parsed.setdefault("week_start", week_start)
        if week_end: parsed.setdefault("week_end", week_end)

        # Vyčistenie a validácia dátumov
        parsed = _basic_shape_sanitize(parsed)
        ok_dates, bad_dates = _validate_dates_in_range(
            parsed, week_start=week_start, week_end=week_end
        )

        if not ok_dates:
            err_msg = f"AI vrátilo dátumy mimo rozsahu týždňa: {bad_dates[:5]}"
            return None, trace, err_msg

        if not trace.get("ok_model"):
            trace["ok_model"] = parsed.get("model")

        return parsed, trace, None

    # Zlyhanie (po vyčerpaní všetkých fallbackov v provideri)
    err_msg = res.error.message if res.error else "Daily plan generation failed"
    return None, trace, err_msg
