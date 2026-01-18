# ===== Routes_AI/daily_plan_generate.py =====
from __future__ import annotations

from datetime import datetime, timezone
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


def _summarize_day_constraints(context_payload: Dict[str, Any]) -> str:
    dcs = context_payload.get("day_constraints") or []
    if not isinstance(dcs, list) or not dcs:
        return "day_constraints: <missing/empty>"
    parts: List[str] = []
    for dc in dcs:
        if not isinstance(dc, dict):
            continue
        ds = str(dc.get("date") or "")[:10]
        if not ds:
            continue
        open_slots = dc.get("open_slots")
        max_s = dc.get("max_sessions")
        locks = dc.get("locks") or []
        locks_n = len(locks) if isinstance(locks, list) else "na"
        parts.append(f"{ds}:{open_slots}/{max_s}/locks={locks_n}")
    return "day_constraints: " + ", ".join(parts)


def _get_constraints_order_and_open_slots(context_payload: Dict[str, Any]) -> Tuple[List[str], Dict[str, int]]:
    """
    Returns:
      - expected_dates_order: list of dates in EXACT order from day_constraints
      - open_slots_by_date: dict date -> open_slots (clamped >=0)

    IMPORTANT:
      day_constraints already contains open_slots computed by builder.
      Using max_sessions - len(locks) is WRONG if locks change later.
      So: prefer dc.open_slots, fallback compute only if missing.
    """
    dcs = context_payload.get("day_constraints") or []
    if not isinstance(dcs, list) or not dcs:
        return [], {}

    expected_dates_order: List[str] = []
    open_slots_by_date: Dict[str, int] = {}

    for dc in dcs:
        if not isinstance(dc, dict):
            continue
        ds = str(dc.get("date") or "")[:10]
        if not ds:
            continue

        expected_dates_order.append(ds)

        # SOURCE OF TRUTH:
        if isinstance(dc.get("open_slots"), int):
            open_slots = int(dc.get("open_slots") or 0)
            if open_slots < 0:
                open_slots = 0
            open_slots_by_date[ds] = open_slots
            continue

        # fallback only if open_slots missing
        max_sessions = dc.get("max_sessions")
        if not isinstance(max_sessions, int) or max_sessions < 0:
            max_sessions = 0

        locks = dc.get("locks") or []
        if not isinstance(locks, list):
            locks = []

        open_slots = max_sessions - len(locks)
        if open_slots < 0:
            open_slots = 0

        open_slots_by_date[ds] = int(open_slots)

    return expected_dates_order, open_slots_by_date


def _contains_lock_payload(session: Dict[str, Any]) -> bool:
    payload = session.get("payload")
    if not isinstance(payload, dict):
        return False
    if isinstance(payload.get("fixed_slot"), dict):
        return True
    if isinstance(payload.get("external_event"), dict):
        return True
    return False


def _validate_free_plan_against_constraints(
    parsed: Dict[str, Any],
    context_payload: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    """
    Validation for NEW behavior:
    - AI returns ONLY free sessions.
    - sessions_count must be <= open_slots for date.
      open_slots == 0 => sessions MUST be []
      open_slots >= 1 => sessions MAY be 0..open_slots
    - must not output lock payloads (fixed_slot/external_event) in free sessions.
    - output DAYS exactly matching day_constraints:
        same count, same dates, same order.
    - If day_constraints missing: must follow fallback contract:
        days==[] and warnings contains 'missing_day_constraints'
    """
    errors: List[str] = []

    expected_dates_order, open_slots_by_date = _get_constraints_order_and_open_slots(context_payload)
    has_constraints = bool(expected_dates_order)

    days = parsed.get("days")
    if not isinstance(days, list):
        return False, ["parsed.days is not a list"]

    # Fallback mode contract (no skeleton => do NOT invent plan)
    if not has_constraints:
        if len(days) != 0:
            errors.append("missing day_constraints but parsed.days is not empty")
        warnings = parsed.get("warnings") or []
        if not (isinstance(warnings, list) and any(str(w) == "missing_day_constraints" for w in warnings)):
            errors.append("missing day_constraints but parsed.warnings does not contain 'missing_day_constraints'")
        return (len(errors) == 0), errors

    # Strict day list: exact order, exact count
    out_dates_order: List[str] = []
    seen: set = set()

    for d in days:
        if not isinstance(d, dict):
            continue
        ds = str(d.get("date") or "")[:10]
        if not ds:
            continue
        out_dates_order.append(ds)
        if ds in seen:
            errors.append(f"duplicate day.date in output: {ds}")
        seen.add(ds)

    if len(out_dates_order) != len(expected_dates_order):
        errors.append(f"days_count={len(out_dates_order)} != expected_count={len(expected_dates_order)}")

    if out_dates_order != expected_dates_order:
        errors.append(f"day order mismatch. expected={expected_dates_order[:7]}..., got={out_dates_order[:7]}...")

    # date -> day map
    by_date: Dict[str, Dict[str, Any]] = {}
    for d in days:
        if isinstance(d, dict):
            ds = str(d.get("date") or "")[:10]
            if ds:
                by_date[ds] = d

    # Sessions count cap + payload hygiene
    for ds in expected_dates_order:
        open_slots = int(open_slots_by_date.get(ds, 0))
        if open_slots < 0:
            open_slots = 0

        day = by_date.get(ds)
        if not isinstance(day, dict):
            errors.append(f"{ds}: missing day object")
            continue

        sessions = day.get("sessions")
        if sessions is None:
            sessions = []
        if not isinstance(sessions, list):
            errors.append(f"{ds}: sessions is not a list")
            continue

        # NEW CAP rules
        if open_slots == 0 and len(sessions) != 0:
            errors.append(f"{ds}: open_slots=0 but sessions_count={len(sessions)} (must be 0)")
        if len(sessions) > open_slots:
            errors.append(f"{ds}: sessions_count={len(sessions)} > open_slots={open_slots}")

        for s in sessions:
            if not isinstance(s, dict):
                errors.append(f"{ds}: session is not an object")
                continue
            if _contains_lock_payload(s):
                errors.append(f"{ds}: free session contains forbidden lock payload (fixed_slot/external_event)")

    ok = len(errors) == 0
    return ok, errors

def generate_daily_week_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI client for DAILY PLAN of one week.
    Returns (daily_dict, debug_trace_or_None).

    This file does NOT inject locks or trim sessions.
    It only:
      - calls the LLM,
      - parses JSON,
      - adds minimal meta,
      - validates the NEW "free sessions only" contract vs day_constraints.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # Allow forcing debug on Railway without touching FE
    if str(os.getenv("DAILY_DEBUG_RAW", "0") or "").strip().lower() in {"1", "true", "yes", "on"}:
        debug_raw = True

    raw_settings = context_payload.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    _dprint("=== generate_daily_week_json start ===")
    _dprint("model_hint=", model, "| debug_raw=", debug_raw)
    _dprint(_summarize_day_constraints(context_payload))

    system_txt, user_txt, fixed_slots_from_template, strength_target = _build_prompts_for_daily(
        context_payload,
        settings=settings,
    )

    _dprint("prompt sizes: system_chars=", len(system_txt), "| user_chars=", len(user_txt))
    _dprint("fixed_slots_from_template=", len(fixed_slots_from_template), "| strength_target=", strength_target)

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")

    timeout_env = os.getenv("OPENAI_TIMEOUT_S")
    if timeout_env:
        try:
            timeout_s = int(timeout_env)
        except Exception:
            timeout_s = int(LLM_TIMEOUT_S or 45)
    else:
        timeout_s = int(LLM_TIMEOUT_S or 45)

    if timeout_s < 10:
        timeout_s = 10
    if timeout_s > 120:
        timeout_s = 120

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = llm_models_priority(model)
    token_budgets = [2500, 2200, 2000]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    if debug_raw:
        trace["system_prompt"] = system_txt
        trace["user_prompt"] = user_txt
        trace["fixed_slots_from_template"] = fixed_slots_from_template
        trace["strength_target"] = strength_target
        trace["timeout_s"] = timeout_s

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

    _dprint("openai: retries=", retries, "| timeout_s=", timeout_s, "| models=", models)

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

                # minimal meta enrichment only
                now_local = datetime.now(tzinfo)
                parsed["schema_version"] = int(parsed.get("schema_version") or 2)
                parsed["generated_at"] = now_local.isoformat()
                parsed["model"] = m

                parsed.setdefault("week_index", week_index)
                if week_start:
                    parsed.setdefault("week_start", week_start)
                if week_end:
                    parsed.setdefault("week_end", week_end)

                if "days" not in parsed or not isinstance(parsed["days"], list):
                    parsed["days"] = []

                ok, errs = _validate_free_plan_against_constraints(parsed, context_payload)
                if not ok:
                    last_err = "AI output violates day_constraints/free-sessions contract"
                    attempt_row["ok"] = False
                    attempt_row["validation_errors"] = errs[:12]
                    _dprint("validation FAILED:", errs[:12])
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

                _dprint("validation OK -> return model=", m)
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