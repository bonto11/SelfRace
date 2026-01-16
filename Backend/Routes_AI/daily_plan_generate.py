# Routes_AI/daily_plan_generate.py
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


def generate_daily_week_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI client pre DAILY PLAN jedného týždňa.
    Vždy vracia (daily_dict, debug_trace_or_None).

    NOTE: Žiadne server-side dopĺňanie / enforce lockov / trimovanie.
    Čisto AI output + minimálne meta polia.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    raw_settings = context_payload.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    system_txt, user_txt, fixed_slots_from_template, strength_target = _build_prompts_for_daily(
        context_payload,
        settings=settings,
    )

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

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
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
                if debug_raw:
                    attempt_row["raw_preview"] = raw[:600] + ("…[truncated]" if len(raw) > 600 else "")
                trace["attempts"].append(attempt_row)

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    continue

                now_local = datetime.now(tzinfo)

                # minimal meta enrichment only
                parsed["schema_version"] = int(parsed.get("schema_version") or 1)
                parsed["generated_at"] = now_local.isoformat()
                parsed["model"] = m

                parsed.setdefault("week_index", week_index)
                if week_start:
                    parsed.setdefault("week_start", week_start)
                if week_end:
                    parsed.setdefault("week_end", week_end)

                if "days" not in parsed or not isinstance(parsed["days"], list):
                    parsed["days"] = []

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
                time.sleep(0.5 * attempt)
                continue

    now_fallback = datetime.now(tzinfo).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "daily-fallback",
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "days": [],
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None