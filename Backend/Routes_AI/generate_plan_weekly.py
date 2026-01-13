# Routes_AI/generate_plan_weekly.py
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


# ---------- parsing utils (same as analyze) ----------

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
    Never throws – on failure parsed is None, but cleaned/raw are returned.
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
def _build_prompts_for_weekly(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    context_payload typically looks like:

    {
      "schema_version": 1,
      "user_id": 123,
      "weeks": 6,
      "overwrite": true,
      "analyze_input": { ... },
      "athlete_state": { ... },
      "athlete_state_meta": { ... }
    }
    """
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = "Use 'you' to talk directly to the athlete."
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    else:
        lang_label = "Slovak"
        second_person_note = "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."

    analyze_input = context_payload.get("analyze_input") or {}

    # prefs can be directly present or under .value (same pattern as daily)
    raw_prefs = analyze_input.get("prefs") or context_payload.get("prefs") or {}
    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
        raw_prefs["value"], dict
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    weeks = int(prefs.get("weeks") or context_payload.get("weeks") or 6)
    start_date = (
        prefs.get("start_date")
        or prefs.get("plan_start_date")
        or (context_payload.get("plan_meta") or {}).get("start_date")
        or ""
    )
    main_sport = prefs.get("main_sport") or "run"
    goal_kind = prefs.get("goal_kind") or "improve_overall"

    volume_prefs = prefs.get("volume") or {}

    # attach user_settings into context so LLM vidí, že existujú
    if settings:
        context_payload = dict(context_payload)
        context_payload["user_settings"] = settings

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON with athlete preferences (including volume preferences), "
        "AI analysis state, recent load, thresholds, zones and external events. "
        "External events are fixed activities like football matches, club runs or other regular trainings, "
        "which already create load and must be counted into total weekly volume or at least reduce the room for training. "
        "The AI analysis (athlete_state.ai_state) also includes a plan_adjustment block that can suggest "
        "short-term softening of load or a need to re-plan the weekly structure. "
        "Your task is to design a WEEK-BY-WEEK meta training plan (no daily sessions yet). "
        "You must return ONE valid JSON object only. No prose, no code fences."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name or 'Trainalyze Coach')",
  "plan_meta": {{
    "start_date": "YYYY-MM-DD" | null,
    "weeks": number,
    "main_sport": string,
    "goal_kind": string | null
  }},
  "weeks": [
    {{
      "week_index": number,          // 1-based index within the plan
      "week_start": "YYYY-MM-DD",    // start of the week (e.g. Monday)
      "week_end": "YYYY-MM-DD",      // end of the week
      "goal": string | null,         // short weekly goal in {lang_label}, speaking directly to the athlete (2nd person)
      "focus": string | null,        // e.g. endurance, threshold, VO2, race, recovery – in {lang_label}, 2nd person if possible
      "load_phase": string | null,   // e.g. base, build, peak, taper, recovery
      "planned_km": number | null,   // approximate planned distance in km for main sport (if relevant)
      "planned_minutes": number | null, // approximate planned total training time for all sports (incl. external sports events)
      "notes": string | null         // short notes in {lang_label}, addressing the athlete directly ("this week you should...")
    }}
  ]
}}
""".strip()

    # Explain to the LLM how to handle volume and external events
    volume_hint_lines: List[str] = []

    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    if volume_mode == "weekly_hours" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            "- In prefs.volume the athlete has a target as weekly_hours. "
            "Convert this to minutes (hours * 60) and treat it as the baseline weekly volume target."
        )
    elif volume_mode == "daily_minutes" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            "- In prefs.volume the athlete has a target as daily_minutes. "
            "You can approximate the number of training days from prefs.preferences.days_off, "
            "so training_days ≈ 7 - count(days_off). "
            "The baseline weekly volume target ≈ daily_minutes * training_days."
        )
    else:
        volume_hint_lines.append(
            "- prefs.volume.value is null or missing, so estimate the target volume "
            "from recent_load, recovery and ai_state.volume_tolerance. Be conservative."
        )

    volume_hint_lines.append(
        "- In athlete_state.ai_state.volume_tolerance you have weekly_minutes_min and weekly_minutes_max. "
        "When designing planned weeks, keep planned_minutes of each week mostly inside this range. "
        "Short-term deviations are possible but should not be extreme."
    )

    volume_hint_lines.append(
        "- The block analyze_input.external_events contains external events (definitions and calendar occurrences). "
        "Treat sports-type events (football, club trainings, etc.) as part of the training load – "
        "planned_minutes for a given week should include a reasonable estimate of these sports events. "
        "For non-sport life events (wedding, long travel, etc.) reduce the available time for training "
        "and usually lower planned_minutes for that week."
    )

    volume_hint_lines.append(
        "- Use recent_load and recovery to shape load progression: for example a cycle of "
        "2–3 higher load weeks followed by 1 lighter recovery week, without chronically exceeding "
        "volume_tolerance.weekly_minutes_max."
    )

    volume_hint = "\n".join(volume_hint_lines)

    user_txt = (
        "You will design a WEEKLY meta training plan for the athlete.\n"
        f"Main sport: {main_sport}\n"
        f"Goal kind: {goal_kind}\n"
        f"Planning horizon (weeks): {weeks}\n"
        f"Preferred plan start date (if any): {start_date or 'none'}\n"
        f"Target athlete language for all text fields: {lang_label}.\n\n"
        "The CONTEXT_JSON you receive contains:\n"
        "- analyze_input.user: basic profile (age, history, etc.)\n"
        "- analyze_input.zones: training zones\n"
        "- analyze_input.thresholds: thresholds (especially running LT2)\n"
        "- analyze_input.bests: personal bests\n"
        "- analyze_input.recent_load: volume and intensity of the last weeks\n"
        "- analyze_input.recovery: HRV, RHR, subjective fatigue, etc.\n"
        "- analyze_input.prefs or analyze_input.prefs.value: coach prefs (goals, days_off, main_sport, volume, ...)\n"
        "- analyze_input.active_plan: previous/active plan if it exists\n"
        "- analyze_input.external_events: external sports and life events that either create training load\n"
        "  (team sports, regular trainings) or take away time for training (weddings, long travel, etc.)\n"
        "- athlete_state: AI analysis from the previous step (ai_state + user_summary), including ai_state.plan_adjustment\n"
        "- user_settings: optional user settings including language/timezone/units.\n\n"
        "CONTEXT_JSON (ground truth – use it as the only source of information):\n"
        + json.dumps(context_payload, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema (you may set numeric fields to null if unknown).\n"
        f"- All free text fields (goal, focus, notes) MUST be written in {lang_label} and MUST speak directly to the athlete in 2nd person. "
        f"{second_person_note} Never refer to them as 'the athlete', 'he', 'she' or similar.\n"
        "- Make sure week_index starts at 1 and increases consecutively (1, 2, 3, ...).\n"
        "- week_start and week_end must be valid dates and form continuous, non-overlapping weeks.\n"
        "- Use athlete_state.ai_state (fitness, fatigue, injury risk, volume_tolerance, intensity_tolerance, plan_adjustment)\n"
        "  to assign load_phase and decide the load progression across weeks.\n"
        "- Respect as much as possible the requested number of weeks (context_payload.weeks or prefs.weeks).\n"
        "- Do NOT generate daily sessions here – only the weekly meta information.\n"
        "- planned_minutes must represent the approximate total training time per week, including sports-type external events\n"
        "  that carry meaningful intensity. For big non-sport events, reduce planned_minutes because there is less room for training.\n"
        "- When planning the overall volume and progression, follow these guidelines:\n"
        + volume_hint
        + "\n"
        "- If athlete_state.ai_state.fatigue_level = 'high' or injury_risk = 'high', "
        "make at least the first week a clear recovery week with planned_minutes close to weekly_minutes_min.\n"
        "- If athlete_state.ai_state.plan_adjustment.soften_next_days.should_soften is true (when present), "
        "ensure that at least the first week (and optionally the second) is visibly lighter: "
        "lower planned_minutes (within or slightly below weekly_minutes_min), "
        "use recovery-oriented load_phase and focus, and mention the reason briefly in notes.\n"
        "- If athlete_state.ai_state.plan_adjustment.should_replan_weekly is true (when present), "
        "assume the previous weekly structure is no longer optimal and design a structurally improved plan for the whole horizon "
        "instead of copying any previous pattern; reflect the re-alignment in the first week's goal/notes.\n"
        "- Do NOT recommend a long-term trend where most weeks are far above volume_tolerance.weekly_minutes_max.\n"
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


def generate_weekly_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI client for WEEKLY PLAN.

    Always returns (weekly_dict, debug_trace_or_None).
    When AI fails, weekly_dict is a simple fallback with error info.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # --- load user settings (language + timezone) ---
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

    system_txt, user_txt = _build_prompts_for_weekly(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [1800, 1500, 1200]

    # timezone for generated_at
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(tz_name)
    except Exception:
        tzinfo = timezone.utc

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

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

                # sanity defaults (LOCAL time)
                now_local = datetime.now(tzinfo)

                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                parsed["generated_at"] = now_local.isoformat()
                if "model" not in parsed:
                    parsed["model"] = m

                # ensure plan_meta.weeks is set from context if missing
                plan_meta = parsed.get("plan_meta") or {}
                if "weeks" not in plan_meta or plan_meta.get("weeks") is None:
                    analyze_input = context_payload.get("analyze_input") or {}
                    raw_prefs = analyze_input.get("prefs") or context_payload.get("prefs") or {}
                    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
                        raw_prefs["value"], dict
                    ):
                        prefs = raw_prefs["value"]
                    else:
                        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}
                    plan_meta["weeks"] = int(
                        prefs.get("weeks") or context_payload.get("weeks") or 6
                    )
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

    # Fallback – AI completely failed (still use local tz)
    analyze_input_fb = context_payload.get("analyze_input") or {}
    raw_prefs_fb = analyze_input_fb.get("prefs") or context_payload.get("prefs") or {}
    if isinstance(raw_prefs_fb, dict) and "value" in raw_prefs_fb and isinstance(
        raw_prefs_fb["value"], dict
    ):
        prefs_fb = raw_prefs_fb["value"]
    else:
        prefs_fb = raw_prefs_fb if isinstance(raw_prefs_fb, dict) else {}

    now_iso = datetime.now(tzinfo).isoformat()
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
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None