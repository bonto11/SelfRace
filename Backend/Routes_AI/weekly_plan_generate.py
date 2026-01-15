# Routes_AI/weekly_plan_generate.py
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
from Routes_AI.weekly_plan_prompts import build_prompts_for_weekly
from Routes_AI.weekly_plan_llm import llm_models_priority, call_openai_raw, parse_ai_json


def generate_weekly_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # ✅ authoritative user_id is always context_payload.user_id
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

    system_txt, user_txt = build_prompts_for_weekly(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = llm_models_priority(model)
    token_budgets = [1800, 1500, 1200]

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(tz_name)
    except Exception:
        tzinfo = timezone.utc

    trace: Dict[str, Any] = {"models_tried": models, "attempts": [], "usage": {}}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    # ✅ authoritative weeks horizon
    horizon_weeks: int = 6
    try:
        horizon_weeks = int(context_payload.get("weeks") or 6)
    except Exception:
        horizon_weeks = 6

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw, usage = call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                attempt_row: Dict[str, Any] = {
                    "model": m,
                    "attempt": attempt,
                    "ok": parsed is not None,
                    "duration_ms": dur_ms,
                }
                if debug_raw:
                    attempt_row["raw_preview"] = raw[:600] + (
                        "…[truncated]" if len(raw) > 600 else ""
                    )
                trace["attempts"].append(attempt_row)

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
                parsed["model"] = m  # ✅ always real model

                plan_meta = parsed.get("plan_meta") or {}
                if not isinstance(plan_meta, dict):
                    plan_meta = {}

                # ✅ ensure weeks is always consistent with horizon
                if plan_meta.get("weeks") is None:
                    plan_meta["weeks"] = horizon_weeks

                parsed["plan_meta"] = plan_meta

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

    # Fallback
    now_iso = datetime.now(tzinfo).isoformat()

    prefs_fb = context_payload.get("prefs") or {}
    # allow prefs.value
    if isinstance(prefs_fb, dict) and isinstance(prefs_fb.get("value"), dict):
        prefs_fb = prefs_fb["value"]

    fallback = {
        "schema_version": 1,
        "generated_at": now_iso,
        "model": "weekly-fallback",
        "plan_meta": {
            "start_date": (prefs_fb.get("start_date") or prefs_fb.get("plan_start_date")) if isinstance(prefs_fb, dict) else None,
            "weeks": horizon_weeks,
            "main_sport": (prefs_fb.get("main_sport") if isinstance(prefs_fb, dict) else None) or "run",
            "goal_kind": (prefs_fb.get("goal_kind") if isinstance(prefs_fb, dict) else None) or "improve_overall",
        },
        "weeks": [],
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None