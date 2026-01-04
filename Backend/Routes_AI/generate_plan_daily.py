# Routes_AI/generate_plan_daily.py
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

# ---------- parsing utils (same as analyze/weekly) ----------

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


def _minify_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return a trimmed-down version of context_payload for the LLM:
    - keep only what is actually needed for planning,
    - drop cosmetic things like coach_tone, rehab_focus, secondary_mix etc.,
    - keep volume prefs, weekly_template and external_events.
    """
    ctx2: Dict[str, Any] = {}

    # week meta
    if "week" in ctx:
        ctx2["week"] = ctx["week"]

    # zones & thresholds & recent_load
    if "zones" in ctx:
        ctx2["zones"] = ctx["zones"]
    if "thresholds" in ctx:
        ctx2["thresholds"] = ctx["thresholds"]
    if "recent_load" in ctx:
        ctx2["recent_load"] = ctx["recent_load"]

    # ---- PREFS (flatten .value if present) ----
    raw_prefs = ctx.get("prefs") or {}
    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
        raw_prefs["value"], dict
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    prefs2: Dict[str, Any] = {}
    prefs2["main_sport"] = prefs.get("main_sport")
    prefs2["start_date"] = prefs.get("start_date")
    prefs2["preferences"] = prefs.get("preferences") or {}

    # volume prefs (weekly_hours / daily_minutes)
    if "volume" in prefs:
        prefs2["volume"] = prefs.get("volume")

    # weeks (if present)
    if "weeks" in prefs:
        prefs2["weeks"] = prefs.get("weeks")

    # strength_settings (for strength mapper, even if LLM does not use it directly)
    if "strength_settings" in prefs:
        prefs2["strength_settings"] = prefs.get("strength_settings")

    # TARGETS – keep only essentials (incl. strength.sessions_per_week)
    targets = (prefs.get("targets") or {}).copy()
    run_t = targets.get("run") or {}
    strength_t = targets.get("strength") or {}

    targets2: Dict[str, Any] = {}
    if run_t:
        targets2["run"] = {
            "race_goal": run_t.get("race_goal"),
            "race_type": run_t.get("race_type"),
            "target_time": run_t.get("target_time"),
            "races": run_t.get("races"),
        }
    if strength_t:
        targets2["strength"] = {
            "focus": strength_t.get("focus"),
            "sessions_per_week": strength_t.get("sessions_per_week"),
        }

    prefs2["targets"] = targets2

    # weekly_template – necháme ju v prefs2 (advanced štruktúra)
    wt = prefs.get("weekly_template")
    if isinstance(wt, dict):
        prefs2["weekly_template"] = wt

    ctx2["prefs"] = prefs2

    # athlete_state – keep only ai_state (volume/intensity tolerance, metrics)
    athlete_state = ctx.get("athlete_state") or {}
    ai_state = athlete_state.get("ai_state") or {}
    ctx2["athlete_state"] = {"ai_state": ai_state}

    # external_events – keep full, LLM will pick relevant days
    if "external_events" in ctx:
        ctx2["external_events"] = ctx["external_events"]

    # top-level helper fields
    if "user_id" in ctx:
        ctx2["user_id"] = ctx["user_id"]
    if "plan_id" in ctx:
        ctx2["plan_id"] = ctx["plan_id"]

    # user_settings (if caller added it)
    if "user_settings" in ctx:
        ctx2["user_settings"] = ctx["user_settings"]

    # weekly_template aj na top-level, ak tam prišlo
    if "weekly_template" in ctx and isinstance(ctx["weekly_template"], dict):
        ctx2["weekly_template"] = ctx["weekly_template"]

    return ctx2


# ---------- prompt builder ----------


def _build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    context_payload typically:
      {
        "week": { ... },            # weekly meta info (goal/focus/load_phase/planned_minutes…)
        "prefs": { ... },           # coach prefs incl. targets, days_off, long_run_days, volume…
        "targets": { ... },         # optional duplicate as flatten
        "athlete_state": { ... },   # output from analyze_athlete_state
        "recent_load": { ... },     # last weeks
        "zones": { ... },
        "thresholds": { ... },
        "external_events": { ... }, # definitions + occurrences of external events (if any)
        "user_settings": { ... }    # optional language / timezone / units...
      }
    """
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    if lang_code.startswith("en"):
        lang_label = "English"
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
    else:
        lang_label = "Slovak"

    week = context_payload.get("week") or {}

    # ---- PREFS (flatten .value if present) ----
    raw_prefs = context_payload.get("prefs") or {}
    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
        raw_prefs["value"], dict
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    targets = context_payload.get("targets") or prefs.get("targets") or {}

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    focus = week.get("focus") or ""
    load_phase = week.get("load_phase") or ""
    planned_minutes = week.get("planned_minutes")
    planned_km = week.get("planned_km")

    main_sport = prefs.get("main_sport") or "run"

    # preferences: days off, long run days, two-a-day rules
    pref_obj = prefs.get("preferences") or {}
    days_off = pref_obj.get("days_off") or []
    long_run_days = pref_obj.get("long_run_days") or []
    avoid_two_a_day = bool(pref_obj.get("avoid_two_a_day"))
    avoid_back_to_back_hard = bool(pref_obj.get("avoid_back_to_back_hard"))

    # --- WEEKLY TEMPLATE (advanced structure) ---
    weekly_template = prefs.get("weekly_template") or {}
    wt_mode = weekly_template.get("mode") or "off"
    wt_days = weekly_template.get("days") or []

    def _summarize_weekly_template(days: List[Dict[str, Any]]) -> str:
        if not isinstance(days, list) or not days:
            return "empty"
        parts: List[str] = []
        for d in days:
            day = d.get("day")
            slots = d.get("slots") or []
            if not day or not isinstance(slots, list) or not slots:
                continue
            slot_descs: List[str] = []
            for s in slots:
                if not isinstance(s, dict):
                    continue
                sport = s.get("sport") or "?"
                kind = s.get("kind") or "?"
                priority = s.get("priority")
                txt = f"{sport}:{kind}"
                if priority:
                    txt += f"({priority})"
                slot_descs.append(txt)
            if slot_descs:
                parts.append(f"{day}={'+'.join(slot_descs)}")
        return ", ".join(parts) if parts else "empty"

    wt_summary = _summarize_weekly_template(wt_days)

    if wt_mode == "off" or wt_summary == "empty":
        weekly_template_line = (
            "- Weekly template: mode='off' (no strict advanced template; "
            "use only prefs.days_off and long_run_days).\n"
        )
    else:
        weekly_template_line = (
            f"- Weekly template mode: '{wt_mode}'. High-level slots per day: {wt_summary}.\n"
            "  Try to follow this structure as long as it does not conflict "
            "with external events, volume or intensity limits.\n"
        )

    # volume prefs
    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    # intensity & volume tolerance from athlete_state
    ai_state = (context_payload.get("athlete_state") or {}).get("ai_state") or {}
    intensity_tol = ai_state.get("intensity_tolerance") or {}
    hard_max = intensity_tol.get("hard_sessions_per_week_max")

    volume_tol = ai_state.get("volume_tolerance") or {}
    weekly_min = volume_tol.get("weekly_minutes_min")
    weekly_max = volume_tol.get("weekly_minutes_max")

    # human-readable strings for prompt
    avoid_two_a_day_str = (
        "- Do NOT schedule two-a-day sessions.\n"
        if avoid_two_a_day
        else "- You may schedule two-a-day sessions if needed.\n"
    )
    avoid_back_to_back_hard_str = (
        "- Do NOT schedule two hard sessions on consecutive days.\n"
        if avoid_back_to_back_hard
        else "- You may schedule two hard sessions on consecutive days if needed.\n"
    )
    days_off_str = ", ".join(days_off) if days_off else "none"
    long_run_str = ", ".join(long_run_days) if long_run_days else "none"

    # strength target
    strength_target = (targets.get("strength") or {}).get("sessions_per_week")
    if strength_target:
        strength_str = f"{strength_target}× per week"
    else:
        strength_str = "no explicit target"

    if hard_max:
        hard_str = f"max {hard_max} hard sessions / week"
    else:
        hard_str = "not specified"

    # volume hints for prompt
    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- Weekly target from WEEK META: planned_minutes ≈ {planned_minutes} min. "
            "The sum of duration_min of all sessions in this week should be close to this (±15%).\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = (
            "- Volume preference: prefs.volume.mode = 'weekly_hours'. "
            f"Target weekly volume ≈ {volume_value * 60:.0f} min of training. "
            "Total duration_min in the week should be around this value, while also respecting volume_tolerance.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "daily_minutes":
        weekly_volume_line = (
            "- Volume preference: prefs.volume.mode = 'daily_minutes'. "
            "Estimated number of training days = 7 - count(prefs.preferences.days_off). "
            "Target weekly volume ≈ daily_minutes * number_of_training_days. "
            "Try to keep the weekly sum of duration_min close to this volume and within volume_tolerance.\n"
        )
    elif isinstance(weekly_min, (int, float)) or isinstance(weekly_max, (int, float)):
        weekly_volume_line = (
            "- Weekly volume tolerance is defined in athlete_state.ai_state.volume_tolerance. "
            "Keep total weekly duration_min between weekly_minutes_min and weekly_minutes_max whenever possible.\n"
        )
    else:
        weekly_volume_line = (
            "- Weekly volume is not explicitly specified. Infer it from recent_load and athlete_state, "
            "and do NOT exceed their typical recent volume by more than ~15–20%.\n"
        )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week (meta info, athlete state, prefs, zones, thresholds, external events). "
        "Your task is to generate DAY-BY-DAY training sessions for that week. "
        "Return ONE valid JSON object only. No prose, no code fences."
    )

    # Strength slots – conceptual description only (no concrete exercise names)
    strength_slots_desc = """
- lower_quad: anterior thighs and glutes (squat-type patterns, step-ups, split squat)
- lower_posterior: hamstrings and posterior chain (hinge patterns like Romanian deadlift, single-leg deadlift)
- core: trunk / midsection (plank-type patterns, anti-rotation, ab wheel)
- upper_pull: pulling patterns for back and biceps (rows, TRX row, band pulls)
- upper_push: pushing patterns for chest and triceps (push-ups, presses)
""".strip()

    schema_text = """
{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
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
            // For endurance sports (run/ride/swim):
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
            },

            // For strength sessions – ONLY slots, no concrete exercise names:
            "strength_exercises"?: [
              {
                "slot": "lower_quad" | "lower_posterior" | "core" | "upper_pull" | "upper_push",
                "sets": number,
                "reps": string,
                "rest_s": number,
                "notes": string | null
              }
            ]
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

    context_for_ai = _minify_context_for_ai(context_payload)
    if settings:
        context_for_ai["user_settings"] = settings

    # Explanation for external_events
    external_hint = (
        "- The context may contain an `external_events` block.\n"
        "  Inside it there is typically a list of concrete occurrences (often under `window.events`)\n"
        "  with fields like `occurrence_date`, `sport`, `duration_min`, `priority`, `title`.\n"
        "- For every occurrence whose date lies between `week_start` and `week_end` (inclusive),\n"
        "  you MUST treat it as an already fixed session that week:\n"
        "    * create a session that clearly represents this event on the same day with a similar load;\n"
        "      if the sport is not `run`/`ride`/`strength`/`swim`, then use `sport: \"other\"` and a short title\n"
        "      based on the event `title` in the target language.\n"
        "    * avoid scheduling another hard session of the SAME type on that day\n"
        "      (for example, do not add a hard run interval session on a football day).\n"
        "- Team sports such as football should usually be treated as high-intensity sessions and\n"
        "  counted as one hard session in that week.\n"
        "- If `duration_min` is null, assume a reasonable load (for team sports ~60–90 min;\n"
        "  for big life events like wedding/travel treat the day mostly as rest with at most very light training).\n"
        "- Never ignore these external events and always include their load in the total weekly duration.\n"
    )

    user_txt = (
        "Generate a DAILY TRAINING PLAN for exactly one calendar week based on the context JSON.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start or 'unknown'} .. {week_end or 'unknown'}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"Preferred days off: {days_off_str}\n"
        f"Preferred long run days: {long_run_str}\n"
        f"{weekly_template_line}"
        f"Strength training target: {strength_str}\n"
        f"Intensity limit: {hard_str}\n"
        f"{weekly_volume_line}"
        "STRENGTH SLOTS (concept only, not concrete exercises):\n"
        + strength_slots_desc
        + "\n\nEXTERNAL EVENTS (fixed activities & life events):\n"
        + external_hint
        + "\n\nCONTEXT_JSON (this is the only ground truth – use it carefully):\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema (you may set some fields to null when unknown).\n"
        f"- All free text for the athlete (titles, notes, etc.) MUST be written in {lang_label} language.\n"
        "- Days must form a continuous sequence within [week_start, week_end].\n"
        "- For each day, `sessions` MUST be a non-empty array. For a rest day, use exactly one session such as:\n"
        '    { \"sport\": \"other\", \"title\": \"Rest day\" (or its translation), \"duration_min\": 0, '
        '\"intensity\": \"rest\", \"session_type\": \"rest_day\" }.\n'
        "- Respect prefs: days_off, long_run_days, and avoid scheduling hard run sessions on days with high-intensity external events.\n"
        f"{avoid_two_a_day_str}"
        f"{avoid_back_to_back_hard_str}"
        "- Use `hard_sessions_per_week_max` from athlete_state.ai_state.intensity_tolerance "
        "to cap the total number of hard/intense sessions per week, INCLUDING high-intensity external events.\n"
        "- If strength.sessions_per_week is >= 1, you MUST schedule approximately that many strength sessions distributed through the week.\n"
        "- For strength sessions, you MUST use only the strength_exercises slot structure. Every item must contain slot, sets, reps, rest_s and notes.\n"
        "- For strength sessions:\n"
        "    * If strength.sessions_per_week == 1 → use 6–8 strength_exercises covering whole body "
        "(lower_quad, lower_posterior, core, upper_pull, upper_push).\n"
        "    * If strength.sessions_per_week == 2 → use 4–6 strength_exercises per session, still covering whole body across the week.\n"
        "    * Otherwise (3+ sessions) → 3–5 strength_exercises per session.\n"
        "- Do NOT invent specific exercise names (like 'plank', 'split squat') – only describe slots and intent in notes.\n"
        "- Keep total weekly load consistent with week.planned_minutes (if provided), volume_tolerance and recent_load.\n"
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
    AI client for DAILY PLAN of a single week.

    Always returns (daily_dict, debug_trace_or_None).
    On failure, daily_dict is a fallback with error info and empty days.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    # --- user settings (language/timezone) – ak sú v konte, použijeme ich ---
    raw_settings = context_payload.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    system_txt, user_txt = _build_prompts_for_daily(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [2500, 2200, 2000]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    week = context_payload.get("week") or {}
    week_index = int(week.get("week_index") or 1)
    week_start = week.get("week_start") or None
    week_end = week.get("week_end") or None

    plan_id_from_ctx = context_payload.get("plan_id")

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

                # sanity defaults (LOCAL time)
                now_local = datetime.now(tzinfo)

                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                parsed["generated_at"] = now_local.isoformat()
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

                # plan_id – len na debug, DB zápis rieši service vrstva
                if plan_id_from_ctx and "plan_id" not in parsed:
                    parsed["plan_id"] = plan_id_from_ctx

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

    # Fallback – AI failed completely (still use local tz for timestamp)
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