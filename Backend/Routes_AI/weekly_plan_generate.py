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
from backend.Routes_AI.weekly_plan_prompts import build_prompts_for_weekly
from Routes_AI.weekly_plan_llm import llm_models_priority, call_openai_raw, parse_ai_json


def generate_weekly_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    analyze_input = context_payload.get("analyze_input") or {}
    user_block = analyze_input.get("user") or {}
    user_id_raw = user_block.get("id") or context_payload.get("user_id")

    user_id: Optional[int] = None
    try:
        if user_id_raw is not None:
            user_id = int(user_id_raw)
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
                # REVIEW: raw_preview len pri debug_raw=True (inak nechceš ukladať/logovať)
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

                # REVIEW/konzistentnosť: vždy nastav reálne použitý model
                parsed["model"] = m

                # ensure plan_meta.weeks is set from context if missing
                plan_meta = parsed.get("plan_meta") or {}
                if "weeks" not in plan_meta or plan_meta.get("weeks") is None:
                    analyze_input2 = context_payload.get("analyze_input") or {}
                    raw_prefs = analyze_input2.get("prefs") or context_payload.get("prefs") or {}
                    if (
                        isinstance(raw_prefs, dict)
                        and "value" in raw_prefs
                        and isinstance(raw_prefs["value"], dict)
                    ):
                        prefs = raw_prefs["value"]
                    else:
                        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}
                    plan_meta["weeks"] = int(prefs.get("weeks") or context_payload.get("weeks") or 6)

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

    now_iso = datetime.now(tzinfo).isoformat()
    analyze_input_fb = context_payload.get("analyze_input") or {}
    raw_prefs_fb = analyze_input_fb.get("prefs") or context_payload.get("prefs") or {}
    if (
        isinstance(raw_prefs_fb, dict)
        and "value" in raw_prefs_fb
        and isinstance(raw_prefs_fb["value"], dict)
    ):
        prefs_fb = raw_prefs_fb["value"]
    else:
        prefs_fb = raw_prefs_fb if isinstance(raw_prefs_fb, dict) else {}

    fallback = {
        "schema_version": 1,
        "generated_at": now_iso,
        "model": "weekly-fallback",
        "plan_meta": {
            "start_date": prefs_fb.get("start_date") or None,
            "weeks": int(prefs_fb.get("weeks") or context_payload.get("weeks") or 6),
            "main_sport": prefs_fb.get("main_sport") or "run",
            "goal_kind": prefs_fb.get("goal_kind") or "improve_overall",
        },
        "weeks": [],
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None