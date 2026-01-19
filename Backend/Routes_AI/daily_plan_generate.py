# ===== Routes_AI/daily_plan_generate.py =====
from __future__ import annotations

from datetime import datetime, timezone, date
from typing import Any, Dict, Optional, Tuple, List

from fastapi import HTTPException
from openai import OpenAI
from zoneinfo import ZoneInfo
import json
import os
import time

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S
from Routes_AI.daily_plan_llm import llm_models_priority, sanitize_json_guess
from Routes_AI.daily_plan_prompts import _build_prompts_for_daily


# -----------------------------------------------------------------------------
# DEBUG (env-controlled)
# -----------------------------------------------------------------------------
# zapneš:
#   DAILY_DEBUG=1
# raw trace:
#   DAILY_DEBUG_RAW=1
_DEBUG_ENABLED = str(os.getenv("DAILY_DEBUG") or "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _dprint(*parts: Any) -> None:
    if not _DEBUG_ENABLED:
        return
    try:
        msg = " ".join(str(p) for p in parts)
        print(f"[DAILY_GEN] {msg}")
    except Exception:
        pass


def _call_openai_raw(
    client: OpenAI,
    model: str,
    system_txt: str,
    user_txt: str,
    max_tokens: int,
) -> Tuple[str, Dict[str, int]]:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        temperature=0.2,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )

    content = (resp.choices[0].message.content or "").strip()
    usage_raw = getattr(resp, "usage", None) or {}

    def _get(u: Any, *names: str) -> int:
        for name in names:
            if hasattr(u, name):
                try:
                    v = getattr(u, name)
                    if v is not None:
                        return int(v)
                except Exception:
                    pass
            if isinstance(u, dict) and name in u:
                try:
                    v = u[name]
                    if v is not None:
                        return int(v)
                except Exception:
                    pass
        return 0

    usage = {
        "prompt_tokens": _get(usage_raw, "prompt_tokens", "input_tokens"),
        "completion_tokens": _get(usage_raw, "completion_tokens", "output_tokens"),
        "total_tokens": _get(usage_raw, "total_tokens"),
    }
    return content, usage


def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    """
    Return (parsed_dict or None, cleaned_text, raw_text).
    Never raises; on failure parsed is None.
    """
    if not raw:
        return None, "", ""

    txt = raw.strip()
    try:
        return json.loads(txt), txt, txt
    except Exception:
        cleaned = sanitize_json_guess(txt)
        try:
            return json.loads(cleaned), cleaned, txt
        except Exception:
            return None, cleaned, txt


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
    Fallback is stricter: date + title must match and session_type must be external_event.
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
                    # If sport_raw present on both sides, require match (reduces false positives).
                    if occ_sport_raw and ev_sport_raw and occ_sport_raw != ev_sport_raw:
                        continue
                    # duration best-effort
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


def generate_daily_week_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI client for DAILY PLAN of one week.
    Returns (daily_dict, debug_trace_or_None).

    Simplified philosophy:
      - AI generates the whole week plan (days + sessions) based on prefs + context.
      - No day_constraints / slot counting / fixed-days logic here.
      - Hard integrity: external events must be included; dates must stay in week range (when known).
      - Max 1 retry (max 2 attempts per model).
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    if str(os.getenv("DAILY_DEBUG_RAW", "0") or "").strip().lower() in {"1", "true", "yes", "on"}:
        debug_raw = True

    raw_settings = context_payload.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    _dprint("=== generate_daily_week_json start ===")
    _dprint("model_hint=", model, "| debug_raw=", debug_raw)

    system_txt, user_txt, _fixed_slots_unused, _strength_target_unused = _build_prompts_for_daily(
        context_payload,
        settings=settings,
    )

    _dprint("prompt sizes: system_chars=", len(system_txt), "| user_chars=", len(user_txt))

    # MAX 1 retry => MAX 2 attempts per model.
    retries_env = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    retries = 2 if retries_env >= 2 else 1

    timeout_env = os.getenv("OPENAI_TIMEOUT_S")
    if timeout_env:
        try:
            timeout_s = int(timeout_env)
        except Exception:
            timeout_s = int(LLM_TIMEOUT_S or 45)
    else:
        timeout_s = int(LLM_TIMEOUT_S or 45)

    timeout_s = max(10, min(120, int(timeout_s)))

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = llm_models_priority(model)

    token_budgets = [2500, 2200]  # 2 attempts max

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    if debug_raw:
        trace["system_prompt"] = system_txt
        trace["user_prompt"] = user_txt
        trace["timeout_s"] = timeout_s
        trace["max_attempts_per_model"] = retries

    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    week = context_payload.get("week") or {}
    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or None
    week_end = week.get("week_end") or context_payload.get("week_end") or None

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    _dprint("openai: retries(max_attempts)=", retries, "| timeout_s=", timeout_s, "| models=", models)

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]

            _dprint("call model=", m, "| attempt=", attempt, "| max_tokens=", budget)

            try:
                raw, usage = _call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = _parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                attempt_row: Dict[str, Any] = {
                    "model": m,
                    "attempt": attempt,
                    "ok": parsed is not None,
                    "duration_ms": dur_ms,
                }

                preview = raw[:240].replace("\n", " ")
                _dprint("raw_preview:", preview + (" …" if len(raw) > 240 else ""))

                _dprint(
                    "usage:",
                    "prompt_tokens=",
                    usage.get("prompt_tokens"),
                    "completion_tokens=",
                    usage.get("completion_tokens"),
                    "total_tokens=",
                    usage.get("total_tokens"),
                    "| duration_ms=",
                    dur_ms,
                )

                if debug_raw:
                    attempt_row["raw_preview"] = raw[:600] + ("…[truncated]" if len(raw) > 600 else "")
                trace["attempts"].append(attempt_row)

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    _dprint("parse failed -> retry; cleaned_preview:", (cleaned[:240].replace("\n", " ")))
                    continue

                now_local = datetime.now(tzinfo)
                parsed["schema_version"] = int(parsed.get("schema_version") or 2)
                parsed["generated_at"] = now_local.isoformat()
                parsed["model"] = m

                parsed.setdefault("week_index", week_index)
                if week_start:
                    parsed.setdefault("week_start", week_start)
                if week_end:
                    parsed.setdefault("week_end", week_end)

                parsed = _basic_shape_sanitize(parsed)

                # hard safety: dates must stay inside the week range (when available)
                ok_dates, bad_dates = _validate_dates_in_range(parsed, week_start=week_start, week_end=week_end)
                if not ok_dates:
                    last_err = "dates_out_of_week_range"
                    attempt_row["ok"] = False
                    attempt_row["validation_errors"] = {"dates_out_of_range": bad_dates[:12]}
                    _dprint("validation FAILED: dates out of range:", bad_dates[:12])
                    continue

                # hard integrity: external events must be present
                ok_ext, missing = _validate_external_events_included(parsed, context_payload)
                if not ok_ext:
                    last_err = "missing_external_events_in_output"
                    attempt_row["ok"] = False
                    attempt_row["validation_errors"] = {"missing_external_events": missing[:12]}
                    _dprint("validation FAILED: missing external events:", missing[:12])
                    continue

                trace["usage"] = {
                    "model": m,
                    "prompt_tokens": int(usage.get("prompt_tokens", 0)),
                    "completion_tokens": int(usage.get("completion_tokens", 0)),
                    "total_tokens": int(usage.get("total_tokens", 0)),
                }

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                _dprint("return model=", m, "| days=", len(parsed.get("days") or []))
                return parsed, trace

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": False,
                        "duration_ms": dur_ms,
                        "error": last_err,
                    }
                )
                _dprint("call exception:", last_err, "| duration_ms=", dur_ms)
                time.sleep(0.5 * attempt)
                continue

    now_fallback = datetime.now(tzinfo).isoformat()
    fallback = {
        "schema_version": 2,
        "generated_at": now_fallback,
        "model": "daily-fallback",
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "days": [],
        "error": last_err,
        "warnings": ["daily_generation_failed"],
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    _dprint("=== generate_daily_week_json fallback ===", "error=", last_err)
    return fallback, trace if debug_raw else None