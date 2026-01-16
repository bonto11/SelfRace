from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}


def _derive_fixed_slots(
    weekly_template: Dict[str, Any],
    max_fixed: int = 7,
) -> List[Dict[str, Any]]:
    if not isinstance(weekly_template, dict):
        return []

    days = weekly_template.get("days")
    if not isinstance(days, list):
        return []

    ordered_days: List[Dict[str, Any]] = sorted(
        (d for d in days if isinstance(d, dict) and isinstance(d.get("day"), str)),
        key=lambda d: WEEKDAY_ORDER.get(str(d.get("day") or ""), 99),
    )

    fixed: List[Dict[str, Any]] = []

    for d in ordered_days:
        day_name = d.get("day")
        slots = d.get("slots") or []
        if not isinstance(slots, list):
            continue

        for s in slots:
            if not isinstance(s, dict):
                continue

            if s.get("priority") != "key":
                continue

            sport = s.get("sport")
            kind = s.get("kind")
            if not (day_name and sport and kind):
                continue

            ai_can_move_val = s.get("ai_can_move")
            hard = ai_can_move_val is False

            fixed.append(
                {
                    "weekday": str(day_name),  # "Tue", "Fri", ...
                    "sport": str(sport),       # "strength", "run", ...
                    "kind": str(kind),         # "full", "long", ...
                    "priority": "key",
                    "ai_can_move": (
                        bool(ai_can_move_val) if ai_can_move_val is not None else True
                    ),
                    "policy": "hard" if hard else "soft",
                }
            )

            if len(fixed) >= max_fixed:
                return fixed

    return fixed


def _minify_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orezaný context pre LLM – len to, čo reálne potrebuje.
    DÔLEŽITÉ: posielame day_constraints (date-based) ako source-of-truth.
    """
    ctx2: Dict[str, Any] = {}

    for k in ("week", "zones", "thresholds", "recent_load", "day_constraints"):
        if k in ctx:
            ctx2[k] = ctx[k]

    raw_prefs = ctx.get("prefs") or {}
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    prefs2: Dict[str, Any] = {
        "main_sport": prefs.get("main_sport"),
        "start_date": prefs.get("start_date"),
        "preferences": prefs.get("preferences") or {},
    }

    for k in ("volume", "weeks", "strength_settings"):
        if k in prefs:
            prefs2[k] = prefs.get(k)

    targets = (prefs.get("targets") or {}).copy()
    run_t = targets.get("run") or {}
    strength_t = targets.get("strength") or {}
    t2: Dict[str, Any] = {}
    if run_t:
        t2["run"] = {
            "race_goal": run_t.get("race_goal"),
            "race_type": run_t.get("race_type"),
            "target_time": run_t.get("target_time"),
            "races": run_t.get("races"),
        }
    if strength_t:
        t2["strength"] = {
            "focus": strength_t.get("focus"),
            "sessions_per_week": strength_t.get("sessions_per_week"),
        }
    prefs2["targets"] = t2

    wt = prefs.get("weekly_template")
    if isinstance(wt, dict):
        prefs2["weekly_template"] = wt

    ctx2["prefs"] = prefs2

    athlete_state = ctx.get("athlete_state") or {}
    ai_state = athlete_state.get("ai_state") or {}
    ctx2["athlete_state"] = {"ai_state": ai_state}

    for k in ("external_events", "last_activities", "user_settings"):
        if k in ctx:
            ctx2[k] = ctx[k]

    return ctx2


def _build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, List[Dict[str, Any]], Optional[int]]:
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = "Always speak directly to the athlete and use 'you'."
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Vždy mluv přímo k atletovi a používej 2. osobu."
    else:
        lang_label = "Slovak"
        second_person_note = "Vždy hovor priamo k atlétovi a používaj 2. osobu."

    week = context_payload.get("week") or {}

    raw_prefs = context_payload.get("prefs") or {}
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
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
    main_sport = prefs.get("main_sport") or "run"

    pref_obj = prefs.get("preferences") or {}
    days_off = pref_obj.get("days_off") or []
    long_run_days = pref_obj.get("long_run_days") or []
    avoid_two_a_day = bool(pref_obj.get("avoid_two_a_day"))
    avoid_back_to_back_hard = bool(pref_obj.get("avoid_back_to_back_hard"))

    weekly_template = (
        prefs.get("weekly_template") or context_payload.get("weekly_template") or {}
    )
    fixed_slots = _derive_fixed_slots(weekly_template, max_fixed=7)

    # targets
    strength_target = (targets.get("strength") or {}).get("sessions_per_week")
    strength_target_int = (
        int(strength_target) if isinstance(strength_target, int) else None
    )

    # count hard fixed slots by sport
    hard_slots = [fs for fs in fixed_slots if fs.get("policy") == "hard"]
    hard_strength_slots = [fs for fs in hard_slots if fs.get("sport") == "strength"]
    hard_strength_n = len(hard_strength_slots)

    # DAY CONSTRAINTS: source of truth
    day_constraints = context_payload.get("day_constraints") or []
    has_day_constraints = isinstance(day_constraints, list) and len(day_constraints) > 0

    # weekly template block: už len reference, nie primárna logika
    weekly_template_reference_line = ""
    if hard_slots:
        hard_human = "; ".join(f"{fs['weekday']}: {fs['sport']}/{fs['kind']}" for fs in hard_slots)
        weekly_template_reference_line = (
            "- Weekly template HARD fixed slots (reference only): "
            f"{hard_human}\n"
        )

    # STRICT day constraints block
    if has_day_constraints:
        constraints_block = (
            "- DAY_CONSTRAINTS (source of truth, date-based, non-negotiable):\n"
            "  You are given `day_constraints` for each date in the week.\n"
            "  For each day:\n"
            "  - You MUST NOT exceed day.max_sessions (hard limit).\n"
            "  - You MUST include ALL items from day.locks as sessions on that exact date.\n"
            "  - If a lock has source='weekly_template', attach payload.fixed_slot with {weekday,sport,kind,policy}.\n"
            "    payload.fixed_slot.weekday MUST match the session's weekday.\n"
            "    Use payload.fixed_slot ONLY for sessions that exist because of a weekly_template lock.\n"
            "  - If a lock has source='external_events', create a session for it on that date.\n"
            "    Attach payload.external_event with at least {title, sport, date} (and duration_min if known).\n"
            "  - If day.max_sessions=1, that day must contain EXACTLY ONE session total.\n"
            "    (So if there is a lock on that day, you must NOT add anything else.)\n"
            "\n"
        )
    else:
        constraints_block = (
            "- DAY_CONSTRAINTS: not provided.\n"
            "  Fall back to prefs/preferences and weekly template.\n"
        )

    # keep your fixed-slot payload rules, but subordinate to day_constraints
    fixed_payload_rules = (
        "- PAYLOAD RULES (strict):\n"
        "  - payload.fixed_slot: ONLY for weekly_template locks (hard fixed days).\n"
        "  - Never reuse the same fixed_slot payload on multiple days.\n"
        "  - Never attach Tue fixed_slot to a Wed session.\n"
    )

    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    ai_state = (context_payload.get("athlete_state") or {}).get("ai_state") or {}
    intensity_tol = ai_state.get("intensity_tolerance") or {}
    hard_max = intensity_tol.get("hard_sessions_per_week_max")

    volume_tol = ai_state.get("volume_tolerance") or {}
    weekly_min = volume_tol.get("weekly_minutes_min")
    weekly_max = volume_tol.get("weekly_minutes_max")

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = f"- Weekly target from WEEK META: planned_minutes ≈ {planned_minutes} min. Total duration_min should be close (±15%).\n"
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = (
            "- Volume preference: prefs.volume.mode='weekly_hours'. "
            f"Target weekly volume ≈ {volume_value * 60:.0f} min.\n"
        )
    elif isinstance(weekly_min, (int, float)) or isinstance(weekly_max, (int, float)):
        weekly_volume_line = "- Weekly volume tolerance is defined in athlete_state.ai_state.volume_tolerance.\n"
    else:
        weekly_volume_line = (
            "- Weekly volume not explicitly specified; infer from recent_load.\n"
        )

    avoid_two_a_day_str = (
        "- Do NOT schedule two-a-day sessions.\n"
        if avoid_two_a_day
        else "- Two-a-day is allowed ONLY if day_constraints.max_sessions allows it.\n"
    )
    avoid_back_to_back_hard_str = (
        "- Do NOT schedule two hard sessions on consecutive days.\n"
        if avoid_back_to_back_hard
        else "- Avoid back-to-back hard days when possible.\n"
    )

    days_off_str = ", ".join(days_off) if days_off else "none"
    long_run_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = (
        f"{strength_target_int}× per week"
        if strength_target_int
        else "no explicit target"
    )
    hard_str = (
        f"max {hard_max} hard sessions / week (including high-intensity external events)"
        if hard_max
        else "not specified"
    )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week. "
        "Generate day-by-day sessions for that week. "
        "Return ONE valid JSON object only. No prose, no code fences."
    )

    strength_slots_desc = """
- lower_quad: anterior thighs and glutes
- lower_posterior: hamstrings and posterior chain
- core: trunk / midsection
- upper_pull: pulling patterns for back and biceps
- upper_push: pushing patterns for chest and triceps
""".strip()

    schema_text = """
{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string",
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
            "warmup"?: { "minutes"?: number, "notes"?: string | null },
            "main"?: [
              { "reps"?: number, "work_min"?: number, "recover_min"?: number, "notes"?: string | null }
            ],
            "cooldown"?: { "minutes"?: number, "notes"?: string | null },
            "strength_exercises"?: [
              { "slot": "lower_quad" | "lower_posterior" | "core" | "upper_pull" | "upper_push", "sets": number, "reps": string, "rest_s": number, "notes": string | null }
            ]
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

    # fixed_slots posielame už len ako reference (day_constraints je nadradený)
    if fixed_slots:
        context_for_ai["fixed_slots"] = fixed_slots

    external_hint = (
        "- The context contains `external_events.occurrences`: concrete occurrences.\n"
        "- Each occurrence has: date (YYYY-MM-DD), weekday (Mon..Sun), sport, title, duration_min, priority, start_time_local.\n"
        "- You MUST include every occurrence in the plan on that exact date.\n"
        "- If day_constraints.max_sessions=1 for that date, the external event must be the only session that day.\n"
    )

    strength_quota_line = (
        f"- Strength quota clarification:\n"
        f"  strength.sessions_per_week target = {strength_str}.\n"
        f"  HARD fixed strength slots in this week = {hard_strength_n}.\n"
        "  If hard_fixed_strength >= target => schedule NO additional strength sessions.\n"
        "  If hard_fixed_strength < target => add only the missing count as NON-fixed strength (no payload.fixed_slot),\n"
        "  but ONLY on dates where day_constraints.max_sessions allows it.\n"
    )

    user_txt = (
        "Generate a DAILY TRAINING PLAN for exactly one calendar week based on the context JSON.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start or 'unknown'} .. {week_end or 'unknown'}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"Preferred days off: {days_off_str}\n"
        f"Preferred long run days: {long_run_str}\n"
        f"{weekly_template_reference_line}"
        f"{constraints_block}"
        f"{fixed_payload_rules}\n"
        f"Strength training target: {strength_str}\n"
        + strength_quota_line
        + f"Intensity limit: {hard_str}\n"
        + f"{weekly_volume_line}"
        + "STRENGTH SLOTS (concept only, not concrete exercises):\n"
        + strength_slots_desc
        + "\n\nSTRENGTH QUALITY RULES:\n"
        + "- For a full strength session: duration_min ~75 (±10), ~9 exercises (2+5+2).\n"
        + "- If you must soften a fixed strength day, keep it on that day; lower load and set session_type='coach_override'.\n"
        + "\n\nEXTERNAL EVENTS:\n"
        + external_hint
        + "\n\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        + "- Always return a single JSON object matching the schema.\n"
        + f"- All free text MUST be written in {lang_label} and address the athlete directly in 2nd person. {second_person_note}\n"
        + "- Days must form a continuous sequence within [week_start, week_end].\n"
        + "- For each day, `sessions` MUST be a non-empty array; rest day = one session with sport 'other' and session_type 'rest_day'.\n"
        + "- Never exceed day_constraints.max_sessions.\n"
        + "- Always include all day_constraints.locks on that exact date.\n"
        + "- Avoid scheduling a hard run workout on the same day as football.\n"
        + avoid_two_a_day_str
        + avoid_back_to_back_hard_str
        + "- Do NOT invent extreme workloads.\n"
    )

    return system_txt, user_txt, fixed_slots, strength_target_int