#Routes_AI/Weekly_prompts
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple


#def minify_weekly_context_for_ai(ctx: Dict[str,Any]) -> Dict[str,Any]:
    # drop user_id, internal ids
    # optionally trim analyze_input fields
    #return ctx2

def build_prompts_for_weekly(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Builds system + user prompts for weekly meta plan.
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

    # prefs can be directly present or under .value
    raw_prefs = analyze_input.get("prefs") or context_payload.get("prefs") or {}
    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(raw_prefs["value"], dict):
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

    # NOTE(review): do LLM payloadu prikladáš celé `user_settings`.
    # Ak by sa ti tam niekedy dostali citlivé polia (email, meno), radšej settings minifikuj upstream.
    if settings:
        context_payload = dict(context_payload)
        context_payload["user_settings"] = settings

    # NOTE(review): Najväčší privacy/scale risk je posielať do LLM celé `analyze_input` bez minifikácie.
    # Lepšia verzia je upstream pripraviť "minified_analyze_input" (bez IDs, bez názvov aktivít,
    # bez presných timestampov) a sem dávať len to.

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
      "focus": string | null,        // in {lang_label}
      "load_phase": string | null,   // base/build/peak/taper/recovery (or similar)
      "planned_km": number | null,   // approximate main sport distance (optional)
      "planned_minutes": number | null, // approximate total training time (incl. external sports events)
      "notes": string | null         // short notes in {lang_label}, addressing the athlete directly
    }}
  ]
}}
""".strip()

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
            "Approximate training_days from prefs.preferences.days_off: training_days ≈ 7 - count(days_off). "
            "Baseline weekly volume ≈ daily_minutes * training_days."
        )
    else:
        volume_hint_lines.append(
            "- prefs.volume.value is null or missing, so estimate the target volume "
            "from recent_load, recovery and ai_state.volume_tolerance. Be conservative."
        )

    volume_hint_lines.append(
        "- In athlete_state.ai_state.volume_tolerance you have weekly_minutes_min and weekly_minutes_max. "
        "Keep planned_minutes mostly inside this range. Short deviations are OK but not extreme."
    )

    volume_hint_lines.append(
        "- analyze_input.external_events contains external sports and life events. "
        "Sports-type events count as training load. Non-sport big events reduce available time and should lower planned_minutes."
    )

    volume_hint_lines.append(
        "- Use recent_load and recovery to shape progression (e.g. 2–3 build weeks + 1 recovery week), "
        "without chronically exceeding weekly_minutes_max."
    )

    volume_hint = "\n".join(volume_hint_lines)

    user_txt = (
        "You will design a WEEKLY meta training plan for the athlete.\n"
        f"Main sport: {main_sport}\n"
        f"Goal kind: {goal_kind}\n"
        f"Planning horizon (weeks): {weeks}\n"
        f"Preferred plan start date (if any): {start_date or 'none'}\n"
        f"Target athlete language for all text fields: {lang_label}.\n\n"
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
        "  to assign load_phase and decide load progression.\n"
        "- Do NOT generate daily sessions here – only weekly meta.\n"
        "- planned_minutes must include meaningful sports-type external events; reduce for big non-sport events.\n"
        "- Volume guidelines:\n"
        + volume_hint
        + "\n"
        "- If fatigue_level='high' or injury_risk='high', make week 1 a clear recovery week near weekly_minutes_min.\n"
        "- If plan_adjustment.soften_next_days.should_soften is true, ensure week 1 (optionally week 2) is visibly lighter.\n"
        "- If plan_adjustment.should_replan_weekly is true, design a structurally improved plan for the whole horizon.\n"
        "- Do NOT plan a long-term trend where most weeks are far above weekly_minutes_max.\n"
    )

    return system_txt, user_txt

