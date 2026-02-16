# ===== Routes_AI/daily_plan_generate.py =====
from __future__ import annotations

from datetime import datetime, timezone, date
from typing import Any, Dict, Optional, Tuple, List
from zoneinfo import ZoneInfo

from Configs.config import LLM_MAX_TOKENS, LLM_TEMPERATURE
from Routes_AI.daily_plan_prompts import build_prompts_for_daily
from Services.AI.provider import ai_call_json_model
from Modules.Supabase.auth import AuthCtx


# -----------------------------------------------------------------------------
# BASIC shape sanitize (NO planning constraints)
# -----------------------------------------------------------------------------
def _basic_shape_sanitize(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal sanity only (NO planning constraints):
    - ensure days is list
    - ensure each day has date and sessions list
    - drop obviously broken day entries
    """
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
        ds = str(d.get("date") or "")[:10]
        if not ds:
            continue
        sessions = d.get("sessions")
        if sessions is None:
            sessions = []
        if not isinstance(sessions, list):
            sessions = []
        out_days.append({"date": ds, "sessions": [s for s in sessions if isinstance(s, dict)]})

    parsed["days"] = out_days
    return parsed


# -----------------------------------------------------------------------------
# HARD integrity helpers (NOT planning constraints)
# -----------------------------------------------------------------------------
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
    """
    Hard safety: do not accept dates outside [week_start..week_end].
    This prevents garbage inserts into DB. Not "planning".
    """
    ws = _parse_iso_date(week_start)
    we = _parse_iso_date(week_end)
    if not ws or not we:
        return True, []  # can't validate if range missing

    bad: List[str] = []
    for d in plan.get("days") or []:
        if not isinstance(d, dict):
            continue
        ds = str(d.get("date") or "")[:10]
        dd = _parse_iso_date(ds)
        if not dd:
            continue
        if dd < ws or dd > we:
            bad.append(ds)

    return (len(bad) == 0), bad


def _get_external_occurrences(context_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Expected shape (from daily builder):
      context_payload["external_events"]["occurrences"] = [{date,title,sport_raw,duration_min,...}]
    """
    ext = context_payload.get("external_events") or {}
    if not isinstance(ext, dict):
        return []
    occ = ext.get("occurrences") or []
    return occ if isinstance(occ, list) else []


def _norm_title(v: Any) -> str:
    return str(v or "").strip().lower()


def _norm_sport_raw(v: Any) -> str:
    return str(v or "").strip().lower()


def _plan_contains_external_occurrence(plan: Dict[str, Any], occ: Dict[str, Any]) -> bool:
    """
    Match external occurrence by payload.external_event first (preferred).
    Fallback: date + title must match and session_type must be external_event.
    """
    if not isinstance(plan, dict) or not isinstance(occ, dict):
        return True  # don't block on garbage

    occ_date = str(occ.get("date") or "")[:10]
    if not occ_date:
        return True

    occ_title = _norm_title(occ.get("title"))
    occ_sport_raw = _norm_sport_raw(occ.get("sport_raw"))
    occ_dur = occ.get("duration_min")
    occ_dur_int = int(occ_dur) if isinstance(occ_dur, (int, float)) else None

    days = plan.get("days") or []
    if not isinstance(days, list):
        return False

    for d in days:
        if not isinstance(d, dict):
            continue
        ds = str(d.get("date") or "")[:10]
        if ds != occ_date:
            continue

        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            continue

        for s in sessions:
            if not isinstance(s, dict):
                continue

            payload = s.get("payload")
            if isinstance(payload, dict) and isinstance(payload.get("external_event"), dict):
                ev = payload["external_event"]
                ev_date = str(ev.get("date") or "")[:10]
                ev_title = _norm_title(ev.get("title"))
                ev_sport_raw = _norm_sport_raw(ev.get("sport_raw"))
                ev_dur = ev.get("duration_min")
                ev_dur_int = int(ev_dur) if isinstance(ev_dur, (int, float)) else None

                if ev_date == occ_date and ev_title == occ_title:
                    if occ_sport_raw and ev_sport_raw and occ_sport_raw != ev_sport_raw:
                        continue
                    if occ_dur_int is not None and ev_dur_int is not None and occ_dur_int != ev_dur_int:
                        continue
                    return True

            # fallback (no payload): must be explicitly marked external
            s_title = _norm_title(s.get("title"))
            s_type = str(s.get("session_type") or "").strip().lower()
            s_dur = s.get("duration_min")
            s_dur_int = int(s_dur) if isinstance(s_dur, (int, float)) else None

            if s_type == "external_event" and s_title == occ_title:
                if occ_dur_int is not None and s_dur_int is not None and occ_dur_int != s_dur_int:
                    continue
                return True

    return False


def _validate_external_events_included(
    parsed: Dict[str, Any],
    context_payload: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    occs = _get_external_occurrences(context_payload)
    if not occs:
        return True, []

    missing: List[str] = []
    for occ in occs:
        if not isinstance(occ, dict):
            continue
        if not _plan_contains_external_occurrence(parsed, occ):
            ds = str(occ.get("date") or "")[:10]
            title = str(occ.get("title") or "external").strip()
            missing.append(f"{ds}:{title}")

    return (len(missing) == 0), missing


# -----------------------------------------------------------------------------
# Trace helpers (ALWAYS ON)
# -----------------------------------------------------------------------------
def _trace_fallback(*, provider: str, model: str) -> Dict[str, Any]:
    return {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": None,  # {prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, model}
        "ok_model": model,
    }


def _get_trace_from_result(res: Any, *, requested_model: Optional[str]) -> Dict[str, Any]:
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


def _sum_usage(a: Optional[Dict[str, Any]], b: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(a, dict) and not isinstance(b, dict):
        return None
    out: Dict[str, Any] = {}
    aa = a if isinstance(a, dict) else {}
    bb = b if isinstance(b, dict) else {}

    # model: keep last non-empty
    out["model"] = str(bb.get("model") or aa.get("model") or "")

    def _i(x: Any) -> int:
        try:
            return int(x or 0)
        except Exception:
            return 0

    out["prompt_tokens"] = _i(aa.get("prompt_tokens")) + _i(bb.get("prompt_tokens"))
    out["completion_tokens"] = _i(aa.get("completion_tokens")) + _i(bb.get("completion_tokens"))
    out["reasoning_tokens"] = _i(aa.get("reasoning_tokens")) + _i(bb.get("reasoning_tokens"))

    tot = _i(aa.get("total_tokens")) + _i(bb.get("total_tokens"))
    if tot <= 0:
        tot = out["prompt_tokens"] + out["completion_tokens"] + out["reasoning_tokens"]
    out["total_tokens"] = tot

    # if all zero -> None
    if out["prompt_tokens"] == 0 and out["completion_tokens"] == 0 and out["reasoning_tokens"] == 0 and out["total_tokens"] == 0:
        return None

    return out

# -----------------------------------------------------------------------------
# Provider-agnostic generator (TRACE ALWAYS)
# -----------------------------------------------------------------------------
def generate_daily_week_json(
    context_payload: dict,
    model: Optional[str],
    *,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> Tuple[dict, Dict[str, Any]]:
    """
    Provider-agnostic daily generator:
      - ai_call_json_model()
      - max 2 attempts when hard validation fails (dates/ext events)
      - ✅ ALWAYS returns (parsed_or_fallback, trace)
    """
    ctx: Dict[str, Any] = context_payload if isinstance(context_payload, dict) else {}

    raw_settings = ctx.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    system_txt, user_txt, _fixed_slots_unused, _strength_target_unused = build_prompts_for_daily(
        ctx,
        settings=settings,
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

    resolved_max_tokens = int(max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2500))
    resolved_temperature = float(temperature if temperature is not None else (LLM_TEMPERATURE or 0.2))

    requested_model = model.strip() if isinstance(model, str) and model.strip() else None

    attempts = 2

    trace: Dict[str, Any] = {
        "provider": None,
        "models_tried": [],
        "attempts": [],
        "usage": None,       # last usage wins (billing expects trace["usage"])
        "usage_sum": None,   # optional sum across attempts
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

    print("generate_daily_week_json context_payload",context_payload)

    for attempt in range(1, attempts + 1):
        res = ai_call_json_model(
            context_payload=ctx,
            system_prompt=system_txt,
            user_instructions=user_txt,
            model=requested_model,  # None => provider default
            max_tokens=resolved_max_tokens,
            temperature=resolved_temperature,
        )

        print("generate_daily_week_json res",res)

        # --- safe error fields ---
        err = getattr(res, "error", None)
        err_code = getattr(err, "code", None) if err is not None else None
        err_msg = getattr(err, "message", None) if err is not None else None

        # --- normalize provider trace (may live on res.trace or res.error.trace) ---
        tr = _get_trace_from_result(res, requested_model=requested_model)

        # update top-level trace meta (keep last)
        trace["provider"] = tr.get("provider") or getattr(res, "provider", None)
        trace["ok_model"] = tr.get("ok_model") or getattr(res, "model", None)
        if isinstance(tr.get("models_tried"), list) and tr.get("models_tried"):
            trace["models_tried"] = tr.get("models_tried")

        # usage accumulation
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

        # --- hard success gate (Pylance-safe) ---
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

        ok_dates, bad_dates = _validate_dates_in_range(parsed, week_start=week_start, week_end=week_end)
        if not ok_dates:
            last_err_code = "dates_out_of_week_range"
            last_err_msg = f"AI returned dates outside week range: {bad_dates[:12]}"
            continue

        ok_ext, missing = _validate_external_events_included(parsed, ctx)
        if not ok_ext:
            last_err_code = "missing_external_events_in_output"
            last_err_msg = f"AI omitted external events: {missing[:12]}"
            continue

        # success: stamp ok_model if missing
        if not trace.get("ok_model"):
            trace["ok_model"] = parsed.get("model")

        return parsed, trace

    # fallback
    now_fallback = datetime.now(tzinfo).isoformat()
    fallback: Dict[str, Any] = {
        "schema_version": 2,
        "generated_at": now_fallback,
        "model": "daily-fallback",
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "days": [],
        "error": last_err_msg or "daily_generation_failed",
        "error_code": last_err_code or "daily_generation_failed",
        "warnings": ["daily_generation_failed"],
    }

    trace["error_code"] = last_err_code or "daily_generation_failed"
    trace["error_message"] = last_err_msg or "daily_generation_failed"

    return fallback, trace


