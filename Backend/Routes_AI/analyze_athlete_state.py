# Routes_AI/analyze_athlete_state.py
from __future__ import annotations

from zoneinfo import ZoneInfo
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S
from Services.user_prefs import service_load_user_settings


# ---------- parsing utils (simplified) ----------

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
    Never throws – when parsing fails, parsed is None, but cleaned and raw are returned.
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


def _build_prompts_for_analyze(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    context_payload = CoachAnalyzeInput (what you build in build_input_from_db)

    EXPECTED BLOCKS (important for the LLM):
    - user            – profile, age, training history...
    - zones           – Z1–Z5 based on LTHR/HRmax
    - thresholds      – lactate / FTP, especially running LT2
    - bests           – personal bests
    - recent_load     – volume and intensity of the last weeks
    - recovery        – HRV, RHR, subjective fatigue...
    - prefs           – goals, sports, days_off, etc. (including prefs.volume)
    - external_events – other sports or life events (football, travel, etc.)
                        that already create fixed load or consume time
    - active_plan     – if a plan already exists, you can infer additional load
    - user_settings   – optional block with language / timezone / units, etc.
    """
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    # human-readable language label for instructions
    if lang_code.startswith("en"):
        lang_label = "English"
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
    else:
        # default = Slovak
        lang_label = "Slovak"

    # expose settings to the LLM as part of context
    ctx_for_llm = dict(context_payload)
    if settings:
        ctx_for_llm["user_settings"] = settings

    prefs = ctx_for_llm.get("prefs") or {}
    weeks = int(prefs.get("weeks") or 4)
    main_sport = prefs.get("main_sport") or "run"

    system_txt = (
        "You are an endurance coaching assistant for runners and multisport athletes. "
        "You receive a structured JSON context about an athlete (profile, zones, thresholds, personal bests, "
        "recent load, recovery, preferences including training volume preferences, external events, "
        "and optional user_settings like language or timezone). "
        "External events are non-editable sessions that already create load and must be considered "
        "when judging fatigue and safe volume. "
        "Your task is to analyze the current training state and return a SINGLE valid JSON object "
        "describing the athlete's current fitness, fatigue, risks and recommended block focus. "
        "Do NOT output any prose or code fences, only JSON."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name or 'Trainalyze Coach')",
  "user_summary": {{
    "headline": "short summary in {lang_label} (1 sentence)",
    "bullets": string[],          // 2–5 short bullet points in {lang_label}
    "risks": string[],            // potential risks (fatigue, injury, volume), in {lang_label}
    "suggestions_short": string[] // 2–5 concrete short suggestions for the next weeks, in {lang_label}
  }},
  "ai_state": {{
    "fitness_level": {{
      "run":      {{ "level_1_to_10": number, "comment": string | null }},
      "ride":     {{ "level_1_to_10": number, "comment": string | null }} | null,
      "strength": {{ "level_1_to_10": number, "comment": string | null }} | null
    }},
    "fatigue_level": "low" | "moderate" | "high",
    "injury_risk": "low" | "moderate" | "high",
    "volume_tolerance": {{
      "weekly_minutes_min": number | null,
      "weekly_minutes_max": number | null,
      "note": string | null     // explanation, in {lang_label}
    }},
    "intensity_tolerance": {{
      "hard_sessions_per_week_max": number | null,
      "comment": string | null   // explanation, in {lang_label}
    }},
    "suggested_block_kind": "base_aerobic" | "base_long" | "threshold_speed" | "regeneration" | "race_specific" | string,
    "key_limitations": string[], // in {lang_label}
    "key_strengths": string[],   // in {lang_label}
    "metrics": {{
      "estimated_vo2max": number | null,
      "estimated_5k_time_min": number | null,
      "chronic_load_score": number | null,
      "acute_load_score": number | null
    }}
  }}
}}
""".strip()

    user_txt = (
        "Analyze the following athlete context JSON and fill the schema below.\n"
        f"The main sport is: {main_sport}.\n"
        f"The upcoming planning horizon is about {weeks} weeks.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(ctx_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema "
        "(you may set numeric fields to null if unknown).\n"
        f"- All free text (headline, bullets, risks, suggestions, comments, notes) MUST be written in {lang_label} language.\n"
        "- Headline and bullet points must be short and practical, focused on training.\n"
        "- Use recent_load and recovery data to assess fatigue and injury risk realistically.\n"
        "- Use bests and thresholds to set fitness_level for each sport.\n"
        "- If prefs.volume is defined (mode = 'weekly_hours' or 'daily_minutes' and value != null),\n"
        "  set volume_tolerance.weekly_minutes_min and weekly_minutes_max to reflect a safe range around this target.\n"
        "  As a guideline, think roughly 70–120% of the implied weekly volume, then adjust based on recent_load and recovery.\n"
        "- If prefs.volume.value is null, infer volume_tolerance only from recent_load, recovery and any existing plans, "
        "and stay conservative.\n"
        "- Treat external_events that are sports (team sports, club trainings, etc.) as part of the total training load "
        "when judging safe volume and fatigue.\n"
        "\n"
        "Instructions specifically for external_events:\n"
        "- If an event has recurrence_kind = 'weekly', treat it as a regular part of every training week.\n"
        "- In textual recommendations, DO NOT use wording like 'in weeks with football'.\n"
        "- Instead, use phrases such as 'on the day of football', 'the day before football', "
        "'the day after football', or 'alongside regular football sessions' (translated to the target language).\n"
        "- Single events (recurrence_kind = 'single') should be treated as exceptions in a specific week.\n"
        "- When there is an active_plan, compare its typical weekly load with volume_tolerance; "
        "if it is consistently above tolerance, highlight the risk clearly in risks and suggestions_short.\n"
        "- In suggestions_short, do NOT recommend long-term behaviour that would keep weekly volume "
        "above volume_tolerance.weekly_minutes_max.\n"
        "- In volume_tolerance.note, briefly explain how you estimated the safe range "
        "(for example from prefs.volume, recent_load, external_events, recovery).\n"
        "- Keep all numbers realistic; do not invent extreme values.\n"
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


def generate_athlete_state_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Main AI client for ANALYZE ATHLETE STATE.

    Always returns (state_dict, debug_trace_or_None).
    When AI fails, state_dict is a simple fallback with error info.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # ---- user_id + user_settings ----
    user_block = context_payload.get("user") or {}
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

    # build prompts WITH settings (language etc.)
    system_txt, user_txt = _build_prompts_for_analyze(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [1800, 1500, 1200]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    # timezone for generated_at
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

                # sanity defaults – but use LOCAL time for generated_at
                now_local = datetime.now(tzinfo)

                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                parsed["generated_at"] = now_local.isoformat()
                if "model" not in parsed:
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

    # Fallback – AI failed completely
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
            "fitness_level": {
                "run": {"level_1_to_10": 5, "comment": None},
                "ride": None,
                "strength": None,
            },
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {
                "weekly_minutes_min": None,
                "weekly_minutes_max": None,
                "note": last_err,
            },
            "intensity_tolerance": {
                "hard_sessions_per_week_max": None,
                "comment": None,
            },
            "suggested_block_kind": "regeneration",
            "key_limitations": [],
            "key_strengths": [],
            "metrics": {
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
        },
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None