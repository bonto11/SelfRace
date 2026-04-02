from __future__ import annotations

from datetime import datetime, timezone, date
from typing import Any, Dict, Optional, Tuple, List
from zoneinfo import ZoneInfo

from Configs.config import LLM_MAX_TOKENS, LLM_TEMPERATURE
from Services.AI.daily_plan.prompts import build_prompts_for_daily
from Services.AI.provider.provider import ai_call_json_model
from Modules.Supabase.auth import AuthCtx

def _basic_shape_sanitize(parsed: Dict[str, Any]) -> Dict[str, Any]:
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
            
        # Zabezpečenie, aby aspoň date bolo prítomné priamo na úrovni day
        out_days.append({
            "date": ds,
            "plan_date": ds,
            "weekday": d.get("weekday"),
            "sessions": [s for s in sessions if isinstance(s, dict)]
        })

    parsed["days"] = out_days
    return parsed

def _parse_iso_date(s: Any) -> Optional[date]:
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

def _trace_fallback(*, provider: str, model: str) -> Dict[str, Any]:
    return {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": None,
        "ok_model": model,
    }

def _get_trace_from_result(
    res: Any, *, requested_model: Optional[str]
) -> Dict[str, Any]:
    provider = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or requested_model or "unknown")

    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        tr.setdefault("provider", provider)
        tr.setdefault("models_tried", [])
        tr.setdefault("attempts", [])
        tr.setdefault("usage", None)
        tr.setdefault("ok_model", used_model)
        return tr

    err = getattr(res, "error", None)
    tr2 = getattr(err, "trace", None) if err is not None else None
    if isinstance(tr2, dict):
        tr2.setdefault("provider", provider)
        tr2.setdefault("models_tried", [])
        tr2.setdefault("attempts", [])
        tr2.setdefault("usage", None)
        tr2.setdefault("ok_model", used_model)
        return tr2

    return _trace_fallback(provider=provider, model=used_model)

def _sum_usage(
    a: Optional[Dict[str, Any]], b: Optional[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    if not isinstance(a, dict) and not isinstance(b, dict):
        return None
    out: Dict[str, Any] = {}
    aa = a if isinstance(a, dict) else {}
    bb = b if isinstance(b, dict) else {}

    out["model"] = str(bb.get("model") or aa.get("model") or "")

    def _i(x: Any) -> int:
        try:
            return int(x or 0)
        except Exception:
            return 0

    out["prompt_tokens"] = _i(aa.get("prompt_tokens")) + _i(bb.get("prompt_tokens"))
    out["completion_tokens"] = _i(aa.get("completion_tokens")) + _i(
        bb.get("completion_tokens")
    )
    out["reasoning_tokens"] = _i(aa.get("reasoning_tokens")) + _i(
        bb.get("reasoning_tokens")
    )

    tot = _i(aa.get("total_tokens")) + _i(bb.get("total_tokens"))
    if tot <= 0:
        tot = out["prompt_tokens"] + out["completion_tokens"] + out["reasoning_tokens"]
    out["total_tokens"] = tot

    if (
        out["prompt_tokens"] == 0
        and out["completion_tokens"] == 0
        and out["reasoning_tokens"] == 0
        and out["total_tokens"] == 0
    ):
        return None

    return out

def generate_daily_week_json(
    context_payload: dict,
    model: Optional[str],
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[Optional[dict], Dict[str, Any], Optional[str]]:

    ctx: Dict[str, Any] = context_payload if isinstance(context_payload, dict) else {}

    raw_settings = ctx.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    system_txt, user_txt, _fixed_slots_unused, _strength_target_unused = (
        build_prompts_for_daily(
            ctx,
            settings=settings,
        )
    )

    week = ctx.get("week") or {}
    week_index = int((week.get("week_index") or ctx.get("week_index") or 1) or 1)
    week_start = week.get("week_start") or ctx.get("week_start") or None
    week_end = week.get("week_end") or ctx.get("week_end") or None

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    resolved_max_tokens = int(
        max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2500)
    )
    resolved_temperature = float(
        temperature if temperature is not None else (LLM_TEMPERATURE or 0.2)
    )

    requested_model = (
        model.strip() if isinstance(model, str) and model.strip() else None
    )

    attempts = 2

    trace: Dict[str, Any] = {
        "provider": None,
        "models_tried": [],
        "attempts": [],
        "usage": None,
        "usage_sum": None,
        "ok_model": None,
        "timezone": str(tz_name),
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "max_tokens": resolved_max_tokens,
        "temperature": resolved_temperature,
    }

    last_err_code: Optional[str] = None
    last_err_msg: Optional[str] = None
    usage_sum: Optional[Dict[str, Any]] = None

    for attempt in range(1, attempts + 1):
        res = ai_call_json_model(
            context_payload=ctx,
            system_prompt=system_txt,
            user_instructions=user_txt,
            model=requested_model,
            max_tokens=resolved_max_tokens,
            temperature=resolved_temperature,
        )

        err = getattr(res, "error", None)
        err_code = getattr(err, "code", None) if err is not None else None
        err_msg = getattr(err, "message", None) if err is not None else None

        tr = _get_trace_from_result(res, requested_model=requested_model)

        trace["provider"] = tr.get("provider") or getattr(res, "provider", None)
        trace["ok_model"] = tr.get("ok_model") or getattr(res, "model", None)
        if isinstance(tr.get("models_tried"), list) and tr.get("models_tried"):
            trace["models_tried"] = tr.get("models_tried")

        this_usage = tr.get("usage") if isinstance(tr, dict) else None
        if isinstance(this_usage, dict):
            usage_sum = _sum_usage(usage_sum, this_usage)
            trace["usage"] = this_usage
            trace["usage_sum"] = usage_sum

        trace["attempts"].append(
            {
                "attempt": attempt,
                "ok": bool(getattr(res, "ok", False)),
                "provider": getattr(res, "provider", None),
                "model": getattr(res, "model", None),
                "error_code": err_code,
                "error_message": err_msg,
                "trace": tr,
            }
        )

        if not bool(getattr(res, "ok", False)):
            last_err_code = err_code or "ai_failed"
            last_err_msg = err_msg or "AI provider failed"
            continue

        data = getattr(res, "data", None)
        if not isinstance(data, dict):
            last_err_code = err_code or "ai_failed"
            last_err_msg = err_msg or "AI provider failed"
            continue

        parsed: Dict[str, Any] = dict(data)

        now_local = datetime.now(tzinfo)
        parsed["schema_version"] = int(parsed.get("schema_version") or 2)
        parsed["generated_at"] = now_local.isoformat()
        parsed["model"] = str(getattr(res, "model", None) or requested_model)

        parsed.setdefault("week_index", week_index)
        if week_start:
            parsed.setdefault("week_start", week_start)
        if week_end:
            parsed.setdefault("week_end", week_end)

        parsed = _basic_shape_sanitize(parsed)

        ok_dates, bad_dates = _validate_dates_in_range(
            parsed, week_start=week_start, week_end=week_end
        )
        if not ok_dates:
            last_err_code = "dates_out_of_week_range"
            last_err_msg = f"AI returned dates outside week range: {bad_dates[:12]}"
            continue

        # ✅ Prísna kontrola na `external_event` odstránená!

        if not trace.get("ok_model"):
            trace["ok_model"] = parsed.get("model")

        return parsed, trace, None

    trace["error_code"] = last_err_code or "daily_generation_failed"
    trace["error_message"] = last_err_msg or "daily_generation_failed"

    return None, trace, last_err_msg or "daily_generation_failed"
