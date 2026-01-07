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


# ---------- parsing utils ----------

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
    Nikdy nehádže výnimku – pri chybách vráti parsed=None.
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


# ---------- prompt builder: ANALYZE STATE ----------


def _build_prompts_for_analyze(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    context_payload = CoachAnalyzeInput (čo si skladáš v build_input_from_db)

    Očakávané bloky (pre LLM):
    - user            – profil, vek, tréningová história
    - zones           – Z1–Z5 podľa LTHR/HRmax
    - thresholds      – laktát / FTP, najmä running LT2
    - bests           – osobné rekordy
    - recent_load     – objem a intenzita posledných týždňov
    - recovery        – HRV, RHR, subjektívna únava
    - prefs           – ciele, športy, dni voľna, objem (prefs.volume)
    - external_events – pevné tréningy / zápasy (futbal, klubové tréningy…)
    - active_plan     – info o aktuálnom pláne (ak existuje)
    - last_activities – posledných 4–6 konkrétnych tréningov so zónami
    - user_settings   – jazyk, timezone, jednotky (voliteľné)
    """
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    # prívetivý label jazyka pre inštrukcie
    if lang_code.startswith("en"):
        lang_label = "English"
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
    else:
        lang_label = "Slovak"

    # doplníme user_settings do contextu pre model
    ctx_for_llm = dict(context_payload)
    if settings:
        ctx_for_llm["user_settings"] = settings

    prefs = ctx_for_llm.get("prefs") or {}
    weeks = int(prefs.get("weeks") or 4)
    main_sport = prefs.get("main_sport") or "run"

    system_txt = (
        "You are an endurance coaching assistant for runners and multisport athletes. "
        "You receive a structured JSON context about an athlete (profile, zones, thresholds, personal bests, "
        "recent load, recovery, preferences including training volume, external events, and optional user_settings). "
        "External events are fixed sessions that already create load and must be considered "
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
    }},
    "plan_adjustment": {{
      "soften_next_days": {{
        "should_soften": boolean,
        "days": number | null,        // typically 1–7
        "reason": string | null       // short explanation in {lang_label}
      }},
      "should_replan_weekly": boolean,
      "weekly_replan_reason": string | null,  // why current weekly structure should change, in {lang_label}
      "should_notify_user": boolean,
      "notify_message": string | null // 1–2 short sentences in {lang_label}, e.g. 'Upcoming trainings have been adjusted...'
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
        f"- All free text (headline, bullets, risks, suggestions, comments, notes, reasons, notify_message) MUST be written in {lang_label}.\n"
        "- Keep headline and bullet points short, concrete and training-focused.\n"
        "- Use recent_load, recovery, external_events and last_activities to assess fatigue and injury risk realistically.\n"
        "- Use bests and thresholds to set fitness_level for each sport.\n"
        "- Use last_activities to detect recent anomalies (e.g. unexpected long run, very hard session "
        "before planned intervals).\n"
        "- When such anomalies or poor recovery suggest overload, set plan_adjustment.soften_next_days.should_soften = true, "
        "choose a reasonable days value (typically 1–3) and explain why in plan_adjustment.soften_next_days.reason.\n"
        "- If the current weekly structure looks clearly misaligned with volume_tolerance or recent_load "
        "(too many hard days, sharp jumps in volume), set plan_adjustment.should_replan_weekly = true "
        "and explain why in weekly_replan_reason.\n"
        "- Whenever you change plan_adjustment in a way that should be visible to the athlete "
        "(e.g. soften_next_days, replan_weekly), set should_notify_user = true and provide a short notify_message.\n"
        "- If prefs.volume is defined (mode = 'weekly_hours' or 'daily_minutes' and value != null), "
        "set volume_tolerance.weekly_minutes_min and weekly_minutes_max around this target "
        "(roughly 70–120% of implied weekly volume, adjusted by recent_load and recovery).\n"
        "- If prefs.volume.value is null, infer volume_tolerance only from recent_load, recovery and any existing plans, "
        "and stay conservative.\n"
        "- Treat external_events that are sports (team sports, clubs, etc.) as part of total training load. "
        "Recurring weekly events should be treated as present every week.\n"
        "- In suggestions_short, do NOT recommend long-term behaviour that would keep weekly volume "
        "clearly above volume_tolerance.weekly_minutes_max.\n"
        "- Keep all numbers realistic; do not invent extreme values.\n"
    )

    return system_txt, user_txt

from Services.user_prefs import service_load_user_settings
# už tam máš import zhora pri athlete state – použijeme to isté

def _build_prompts_for_progress(
    previous_state: dict,
    current_state: dict,
    *,
    user_id: Optional[int] = None,
    settings: Optional[Dict[str, Any]] = None,
) -> tuple[str, str]:
    """
    Pripraví system + user prompt pre AI progress report:
    porovnanie dvoch athlete_state JSONov.
    """
    # jazyk z user_settings alebo fallback
    if settings is None:
        settings = {}

    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        lang_label = "English"
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
    else:
        lang_label = "Slovak"

    ctx_for_llm = {
        "previous_state": previous_state or {},
        "current_state": current_state or {},
        "user_settings": settings or {},
    }

    system_txt = (
        "You are an endurance coaching assistant that compares two previously generated "
        "athlete state JSON objects (previous_state and current_state). "
        "Your job is to detect meaningful changes in fitness, fatigue, injury risk, "
        "volume tolerance and recommended block focus, and return a SINGLE valid JSON "
        "object describing the progress. "
        "Do NOT output any prose or code fences, only JSON."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name or 'Trainalyze Coach')",
  "summary": {{
    "headline": "1 sentence summary in {lang_label}",
    "bullets": string[]  // 2–6 short bullets in {lang_label}
  }},
  "comparisons": {{
    "fatigue_level": {{
      "previous": "low" | "moderate" | "high" | null,
      "current": "low" | "moderate" | "high" | null,
      "comment": string | null   // short note in {lang_label}
    }},
    "injury_risk": {{
      "previous": "low" | "moderate" | "high" | null,
      "current": "low" | "moderate" | "high" | null,
      "comment": string | null   // short note in {lang_label}
    }},
    "block_kind": {{
      "previous": string | null,
      "current": string | null,
      "comment": string | null   // short explanation in {lang_label}
    }},
    "fitness_level": {{
      "run": {{
        "previous": number | null,
        "current": number | null,
        "comment": string | null  // in {lang_label}
      }} | null,
      "ride": {{
        "previous": number | null,
        "current": number | null,
        "comment": string | null
      }} | null,
      "strength": {{
        "previous": number | null,
        "current": number | null,
        "comment": string | null
      }} | null
    }},
    "volume_tolerance": {{
      "previous_weekly_minutes_min": number | null,
      "previous_weekly_minutes_max": number | null,
      "current_weekly_minutes_min": number | null,
      "current_weekly_minutes_max": number | null,
      "comment": string | null  // explanation of the change, in {lang_label}
    }},
    "plan_adjustment": {{
      "soften_change": string | null,         // how softening changed, in {lang_label}
      "weekly_replan_change": string | null   // how weekly replan changed, in {lang_label}
    }}
  }},
  "recommendations": {{
    "celebrations": string[],       // positives, in {lang_label}
    "risks_to_watch": string[],     // risks, in {lang_label}
    "focus_next_weeks": string[]    // 3–5 concrete priorities, in {lang_label}
  }}
}}
""".strip()

    user_txt = (
        "You receive two JSON objects: previous_state and current_state. "
        "Each is an athlete state analysis previously generated by another LLM.\n\n"
        "Your tasks:\n"
        "1) Compare the two states and highlight meaningful changes in fatigue, injury risk, "
        "fitness level per sport, block kind, and volume tolerance.\n"
        "2) Fill the JSON schema below with concise, training-focused text.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(ctx_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return exactly one JSON object matching the schema.\n"
        "- All free text (headline, bullets, comments, recommendations) MUST be written in "
        f"{lang_label}.\n"
        "- When there is no meaningful change for a field, you can keep previous and current equal "
        "and still explain it briefly in the comment.\n"
        "- Bullets in summary should be short, concrete descriptions of key changes.\n"
        "- In recommendations.focus_next_weeks, give 3–5 specific, actionable tips for the next weeks, "
        "consistent with the comparisons and with safe volume.\n"
    )

    return system_txt, user_txt
# ---------- OpenAI volanie ----------


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
    Hlavný AI klient pre ANALYZE ATHLETE STATE.

    Vždy vráti (state_dict, debug_trace_or_None).
    Pri zlyhaní AI sa vráti jednoduchý fallback s chybovou správou.
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

                # použijeme lokálny čas pre generated_at
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

    # Fallback – AI zlyhalo úplne
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
            "plan_adjustment": {
                "soften_next_days": {
                    "should_soften": False,
                    "days": None,
                    "reason": None,
                },
                "should_replan_weekly": False,
                "weekly_replan_reason": None,
                "should_notify_user": False,
                "notify_message": None,
            },
        },
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None


# ---------- PROGRESS REPORT: previous_state vs current_state ----------
def generate_athlete_progress_report(
    *,
    previous_state: dict,
    current_state: dict,
    model: str,
    user_id: Optional[int] = None,
    debug_raw: bool = False,
) -> tuple[dict, Optional[dict]]:
    """
    AI klient pre PROGRESS REPORT (porovnanie dvoch athlete_state JSONov).

    Vráti (report_dict, debug_trace_or_None).
    Pri zlyhaní AI sa vráti jednoduchý fallback.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # user settings kvôli jazyku
    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    system_txt, user_txt = _build_prompts_for_progress(
        previous_state=previous_state,
        current_state=current_state,
        user_id=user_id,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [1200, 900, 700]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    # timezone na generated_at
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
                    last_err = "AI returned invalid JSON for progress report"
                    continue

                now_local = datetime.now(tzinfo)

                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                parsed["generated_at"] = now_local.isoformat()
                if "model" not in parsed:
                    parsed["model"] = "Trainalyze Coach"

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

    # fallback – AI zlyhalo
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
        "recommendations": {
            "celebrations": [],
            "risks_to_watch": [],
            "focus_next_weeks": [],
        },
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None