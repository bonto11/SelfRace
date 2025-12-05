# Routes_AI/generate_plan_daily.py
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S


# ---------- parsing utils (copy z analyze/weekly) ----------

CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _strip_codefence(s: str) -> str:
    m = CODEFENCE_RE.search(s)
    return m.group(1).strip() if m else s.strip()


def _find_outer_json_block(s: str) -> str:
    start = s.find("{")
    if start < 0:
        return s
    depth = 0
    for i in range(start, len(s)):
        ch = s[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    end = s.rfind("}")
    return s[start : end + 1] if end > start else s


def _sanitize_json_guess(s: str) -> str:
    s = s.replace("“", '"').replace("”", '"').replace("’", "'")
    s = _strip_codefence(s)
    s = _find_outer_json_block(s)
    s = re.sub(r",\s*([}\]])", r"\1", s)  # trailing commas
    s = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", s)  # bad backslashes
    s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
    return s.strip()


def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    """
    Return (parsed_dict or None, cleaned_text, raw_text).
    Nikdy neháče – keď sa nedá parsovať, parsed je None, ale vrátime cleaned aj raw.
    """
    if not raw:
        return None, "", ""
    try:
        return json.loads(raw.strip()), raw.strip(), raw.strip()
    except Exception:
        cleaned = _sanitize_json_guess(raw or "")
        try:
            return json.loads(cleaned), cleaned, raw
        except Exception:
            return None, cleaned, raw


def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models


# ---------- prompt builder ----------


def _build_prompts_for_daily(context_payload: dict) -> Tuple[str, str]:
    """
    context_payload typicky:
      {
        "week": {...},
        "prefs": { ... coach prefs ... },
        "targets": { ... },
        "athlete_state": { ... },
        "recent_load": { ... },
        "zones": { ... },
        "thresholds": { ... }
      }
    """
    week = context_payload.get("week") or {}
    prefs = context_payload.get("prefs") or {}
    targets = context_payload.get("targets") or {}

    week_index = int(week.get("week_index") or 1)
    week_start = week.get("week_start") or ""
    week_end = week.get("week_end") or ""
    focus = week.get("focus") or ""
    load_phase = week.get("load_phase") or ""
    main_sport = prefs.get("main_sport") or "run"

    strength_targets = targets.get("strength") or {}
    strength_sessions = strength_targets.get("sessions_per_week") or 0

    pref_obj = prefs.get("preferences") or {}
    days_off = pref_obj.get("days_off") or []
    long_run_days = pref_obj.get("long_run_days") or []

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week (meta info, athlete state, prefs, zones, thresholds). "
        "Your task is to generate DAY-BY-DAY training sessions for that week. "
        "Return ONE valid JSON object only. No prose, no code fences."
    )

    schema_text = """
{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp in UTC",
  "model": "string (your model name or 'Trainalyze Coach')",
  "week_index": number,
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "sessions": [
        {
          "sport": "run" | "ride" | "strength" | "swim" | "other",
          "title": string,
          "duration_min": number,
          "intensity": string | null,
          "session_type": string | null,
          "zone_text": string | null,
          "notes": string | null,
          "structure": {
            "warmup"?: {
              "minutes"?: number,
              "notes"?: string | null
            },
            "main"?: [
              {
                "reps"?: number,
                "work_min"?: number,
                "recover_min"?: number,
                "notes"?: string | null
              }
            ],
            "cooldown"?: {
              "minutes"?: number,
              "notes"?: string | null
            }
          },
          "targets"?: {
            "hr_bpm"?: [number, number] | null,
            "pace_min_per_km"?: string | null,
            "power_w"?: number | null
          },
          "payload"?: object | null
        }
      ]
    }
  ]
}
""".strip()

    user_txt = (
        "Generate a DAILY TRAINING PLAN for exactly one calendar week based on the context JSON.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start}..{week_end}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"Preferred days off: {', '.join(days_off) if days_off else 'none'}\n"
        f"Preferred long-run days: {', '.join(long_run_days) if long_run_days else 'none'}\n"
        f"Target strength sessions per week: {strength_sessions}\n\n"
        "CONTEXT_JSON (this is the only ground truth – use it carefully):\n"
        + json.dumps(context_payload, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema (you may set some fields to null when unknown).\n"
        "- All free text (title, notes) MUST be in Slovak language.\n"
        "- Days must form a continuous sequence within [week_start, week_end].\n"
        "- For each day, `sessions` MUST be a non-empty array. If it is a rest day, use exactly one session with:\n"
        "    { \"sport\": \"other\", \"title\": \"Rest day\", \"duration_min\": 0, \"intensity\": \"rest\", \"session_type\": \"rest_day\" }\n"
        "- Respect prefs: days_off, long_run_days, max hard sessions per week, etc., from the context JSON.\n"
        "- If target strength sessions per week > 0, you MUST schedule approximately that many `sport: \"strength\"` sessions, "
        "unless the week is clearly marked as taper / recovery (load_phase).\n"
        "- Use athlete_state (fitness, fatigue, injury risk) to distribute intensity and volume safely.\n"
        "- Do NOT invent extreme workloads. Keep all durations and intensities realistic.\n"
    )
    return system_txt, user_txt


def _call_openai_raw(
    client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int
) -> str:
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
    return (resp.choices[0].message.content or "").strip()


def generate_daily_week_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI klient pre DAILY PLÁN jedného týždňa.

    Vždy vráti (daily_dict, debug_trace_or_None).
    Keď AI zlyhá, daily_dict bude fallback s info o chybe + prázdnym days.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [2500, 2200, 2000]

    system_txt, user_txt = _build_prompts_for_daily(context_payload)

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    week = context_payload.get("week") or {}
    week_index = int(week.get("week_index") or 1)
    week_start = week.get("week_start") or None
    week_end = week.get("week_end") or None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw = _call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)
                parsed, cleaned, raw_keep = _parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": parsed is not None,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:600]
                        + ("…[truncated]" if len(raw) > 600 else ""),
                    }
                )

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    continue

                # sanity defaults
                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                if "generated_at" not in parsed:
                    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
                if "model" not in parsed:
                    parsed["model"] = m
                if "week_index" not in parsed:
                    parsed["week_index"] = week_index
                if "week_start" not in parsed and week_start:
                    parsed["week_start"] = week_start
                if "week_end" not in parsed and week_end:
                    parsed["week_end"] = week_end
                if "days" not in parsed or not isinstance(parsed["days"], list):
                    parsed["days"] = []

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

    # Fallback – AI sa nepodarilo
    now_iso = datetime.now(timezone.utc).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_iso,
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