# Routes_AI/athlete_state_generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S
from Services.user_prefs import service_load_user_settings

from Routes_AI.athlete_state_prompts import (
    build_prompts_for_analyze,
    build_prompts_for_progress,
)
from Routes_AI.athlete_state_llm import (
    llm_models_priority,
    call_openai_raw,
    parse_ai_json,
)


def generate_athlete_state_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # user_id ber radšej z context_payload.user_id (autorita)
    user_id: Optional[int] = None
    try:
        if context_payload.get("user_id") is not None:
            user_id = int(context_payload["user_id"])
    except Exception:
        user_id = None

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    system_txt, user_txt = build_prompts_for_analyze(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = llm_models_priority(model)
    token_budgets = [1800, 1500, 1200]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": [], "usage": {}}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(tz_name)
    except Exception:
        tzinfo = timezone.utc

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw, usage = call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                row: Dict[str, Any] = {
                    "model": m,
                    "attempt": attempt,
                    "ok": parsed is not None,
                    "duration_ms": dur_ms,
                }
                if debug_raw:
                    row["raw_preview"] = raw[:600] + ("…[truncated]" if len(raw) > 600 else "")
                trace["attempts"].append(row)

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    continue

                trace["usage"] = {
                    "model": m,
                    "prompt_tokens": int(usage.get("prompt_tokens", 0)),
                    "completion_tokens": int(usage.get("completion_tokens", 0)),
                    "total_tokens": int(usage.get("total_tokens", 0)),
                }

                now_local = datetime.now(tzinfo)
                parsed["schema_version"] = int(parsed.get("schema_version") or 1)
                parsed["generated_at"] = now_local.isoformat()
                parsed["model"] = m

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return parsed, trace

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err}
                )
                time.sleep(0.5 * attempt)
                continue

    now_fallback = datetime.now(tzinfo).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "analyze-fallback",
        "user_summary": {
            "headline": "Nepodarilo sa získať AI analýzu.",
            "bullets": ["Skús to znova neskôr."],
            "risks": [],
            "suggestions_short": [],
        },
        "ai_state": {
            "fitness_level": {"run": {"level_1_to_10": 5, "comment": None}, "ride": None, "strength": None},
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {"weekly_minutes_min": None, "weekly_minutes_max": None, "note": last_err},
            "intensity_tolerance": {"hard_sessions_per_week_max": None, "comment": None},
            "suggested_block_kind": "regeneration",
            "key_limitations": [],
            "key_strengths": [],
            "metrics": {
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
            "plan_adjustment": {
                "soften_next_days": {"should_soften": False, "days": None, "reason": None},
                "should_replan_weekly": False,
                "weekly_replan_reason": None,
                "should_notify_user": False,
                "notify_message": None,
            },
        },
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None


def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: str,
    user_id: Optional[int] = None,
    debug_raw: bool = False,
) -> tuple[dict, Optional[dict]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    system_txt, user_txt = build_prompts_for_progress(
        previous_state=previous_state,
        current_state=current_state,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = llm_models_priority(model)
    token_budgets = [1200, 900, 700]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": [], "usage": {}}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(tz_name)
    except Exception:
        tzinfo = timezone.utc

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw, usage = call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                row: Dict[str, Any] = {
                    "model": m,
                    "attempt": attempt,
                    "ok": parsed is not None,
                    "duration_ms": dur_ms,
                }
                if debug_raw:
                    row["raw_preview"] = raw[:600] + ("…[truncated]" if len(raw) > 600 else "")
                trace["attempts"].append(row)

                if not parsed:
                    last_err = "AI returned invalid JSON for progress report"
                    continue

                trace["usage"] = {
                    "model": m,
                    "prompt_tokens": int(usage.get("prompt_tokens", 0)),
                    "completion_tokens": int(usage.get("completion_tokens", 0)),
                    "total_tokens": int(usage.get("total_tokens", 0)),
                }

                now_local = datetime.now(tzinfo)
                parsed["schema_version"] = int(parsed.get("schema_version") or 1)
                parsed["generated_at"] = now_local.isoformat()
                parsed["model"] = m

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return parsed, trace

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err}
                )
                time.sleep(0.5 * attempt)
                continue

    now_fallback = datetime.now(tzinfo).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "progress-fallback",
        "summary": {
            "headline": "Nepodarilo sa získať AI progress report.",
            "bullets": ["Skús to neskôr alebo manuálne porovnaj posledné dve analýzy."],
        },
        "comparisons": {},
        "recommendations": {"celebrations": [], "risks_to_watch": [], "focus_next_weeks": []},
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None