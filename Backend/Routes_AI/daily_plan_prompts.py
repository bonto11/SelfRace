# ===== Routes_AI/daily_plan_prompts.py =====
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

# -----------------------------------------------------------------------------
# DEBUG (forced ON)
# -----------------------------------------------------------------------------
# Chcel si "debug rovno na 1" -> tu je natvrdo zapnutý.
# (Keď ťa to začne štvať, prepni na False alebo to daj za env var.)
_DEBUG_ENABLED = True


def _dprint(*parts: Any) -> None:
    if not _DEBUG_ENABLED:
        return
    try:
        msg = " ".join(str(p) for p in parts)
        print(f"[DAILY_PROMPTS] {msg}")
    except Exception:
        pass


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
    """
    Reference-only helper: extracts key slots from weekly_template.
    day_constraints is the real source-of-truth (date-based).
    """
    if not isinstance(weekly_template, dict):
        _dprint("_derive_fixed_slots: weekly_template not dict -> []")
        return []

    days = weekly_template.get("days")
    if not isinstance(days, list):
        _dprint("_derive_fixed_slots: weekly_template.days not list -> []")
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
                    "weekday": str(day_name),
                    "sport": str(sport),
                    "kind": str(kind),
                    "priority": "key",
                    "ai_can_move": (bool(ai_can_move_val) if ai_can_move_val is not None else True),
                    "policy": "hard" if hard else "soft",
                }
            )

            if len(fixed) >= max_fixed:
                _dprint("_derive_fixed_slots: reached max_fixed=", max_fixed)
                return fixed

    _dprint("_derive_fixed_slots: fixed_slots=", len(fixed))
    return fixed


def _minify_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send only what the LLM truly needs.
    CRITICAL: day_constraints is the week skeleton (date-based) and the only hard planner input.
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

    for k in ("volume", "weeks", "strength_settings", "weekly_template"):
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

    ctx2["prefs"] = prefs2

    athlete_state = ctx.get("athlete_state") or {}
    ai_state = athlete_state.get("ai_state") or {}
    ctx2["athlete_state"] = {"ai_state": ai_state}

    for k in ("external_events", "last_activities", "user_settings"):
        if k in ctx:
            ctx2[k] = ctx[k]

    # Debug summary (NEprintuj celé JSONy)
    try:
        dc = ctx2.get("day_constraints") or []
        dc_n = len(dc) if isinstance(dc, list) else 0
        wk = ctx2.get("week") or {}
        _dprint(
            "_minify_context_for_ai:",
            "week_start=",
            wk.get("week_start"),
            "week_end=",
            wk.get("week_end"),
            "| day_constraints=",
            dc_n,
            "| has_external_events=",
            bool(ctx2.get("external_events")),
        )
        if isinstance(dc, list) and dc:
            # krátky prehľad: date open_slots/max/locks
            parts = []
            for d in dc:
                if not isinstance(d, dict):
                    continue
                ds = str(d.get("date") or "")[:10]
                open_slots = d.get("open_slots")
                max_s = d.get("max_sessions")
                locks = d.get("locks") or []
                parts.append(f"{ds}:{open_slots}/{max_s}/locks={len(locks) if isinstance(locks, list) else 'na'}")
            _dprint("day_constraints summary:", ", ".join(parts))
    except Exception as e:
        _dprint("_minify_context_for_ai: debug summary failed:", repr(e))

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

    weekly_template = prefs.get("weekly_template") or context_payload.get("weekly_template") or {}
    fixed_slots = _derive_fixed_slots(weekly_template, max_fixed=7)

    strength_target = (targets.get("strength") or {}).get("sessions_per_week")
    strength_target_int = int(strength_target) if isinstance(strength_target, int) else None

    day_constraints = context_payload.get("day_constraints") or []
    has_day_constraints = isinstance(day_constraints, list) and len(day_constraints) > 0

    # ---------------- DEBUG summary ----------------
    _dprint(
        "build_prompts:",
        "week_index=",
        week_index,
        "| range=",
        week_start,
        "..",
        week_end,
        "| main_sport=",
        main_sport,
        "| planned_minutes=",
        planned_minutes,
        "| fixed_slots=",
        len(fixed_slots),
        "| has_day_constraints=",
        has_day_constraints,
        "| avoid_two_a_day=",
        avoid_two_a_day,
        "| avoid_b2b_hard=",
        avoid_back_to_back_hard,
        "| strength_target=",
        strength_target_int,
    )
    if isinstance(day_constraints, list) and day_constraints:
        try:
            total_open = sum(int(d.get("open_slots") or 0) for d in day_constraints if isinstance(d, dict))
            total_locks = sum(
                len(d.get("locks") or []) for d in day_constraints if isinstance(d, dict) and isinstance(d.get("locks") or [], list)
            )
            _dprint("build_prompts: total_open_slots=", total_open, "| total_locks=", total_locks)
        except Exception as e:
            _dprint("build_prompts: totals failed:", repr(e))
    # ------------------------------------------------

    weekly_template_reference_line = ""
    hard_slots = [fs for fs in fixed_slots if fs.get("policy") == "hard"]
    if hard_slots:
        hard_human = "; ".join(f"{fs['weekday']}: {fs['sport']}/{fs['kind']}" for fs in hard_slots)
        weekly_template_reference_line = (
            "- Weekly template HARD fixed slots (debug/reference only): "
            f"{hard_human}\n"
        )

    days_off_str = ", ".join(days_off) if days_off else "none"
    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"

    skeleton_rules = (
        "- WEEK SKELETON RULES (CRITICAL):\n"
        "  You are given `day_constraints` for each DATE in the week.\n"
        "  Each day has: date (truth), max_sessions, locks[], open_slots.\n"
        "\n"
        "  Your job is ONLY to output FREE sessions that fill open_slots.\n"
        "  DO NOT output locked sessions.\n"
        "  The server will inject locks and enforce max_sessions afterwards.\n"
        "\n"
        "  Output rule per day:\n"
        "    - open_slots == 0 => sessions MUST be []\n"
        "    - open_slots == 1 => sessions MUST have exactly 1 item\n"
        "    - open_slots == 2 => sessions MUST have exactly 2 items\n"
        "\n"
        "  STRICT DAYS RULE:\n"
        "    - Output `days` MUST match day_constraints exactly:\n"
        "      same dates, same count, same order.\n"
        "    - Never add extra days, never skip a date.\n"
    )

    preference_semantics = (
        "- PREFERENCES SEMANTICS:\n"
        f"  - Preferred long run weekday(s): {long_run_days_str}.\n"
        "  - Treat long_run_days as a strong preference when choosing WHICH DAY gets a long run,\n"
        "    but only if that date has open_slots > 0.\n"
        "  - If long run cannot be placed on preferred day(s) due to open_slots=0 or recovery logic,\n"
        "    place it elsewhere and explain it calmly in the long run session notes.\n"
        "\n"
    )

    explanation_rule = (
        "- EXPLANATION RULE (MANDATORY):\n"
        "  Every free session MUST include 1–2 concrete sentences in `notes`:\n"
        "    - why this session type today (spacing / fatigue / prep for upcoming lock), OR\n"
        "    - why a preference could not be followed (e.g. preferred day has open_slots=0).\n"
        "  No fluff. Coach tone. Never say 'AI spravila chybu'.\n"
        "\n"
    )

    fixed_payload_rules = (
        "- PAYLOAD RULES (STRICT):\n"
        "  - Prefer NO payload for free sessions.\n"
        "  - NEVER include payload.fixed_slot or payload.external_event in free sessions.\n"
        "  - Those payload objects are reserved for server-injected locks only.\n"
        "\n"
    )

    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    ai_state = (context_payload.get("athlete_state") or {}).get("ai_state") or {}
    intensity_tol = (ai_state.get("intensity_tolerance") or {}) if isinstance(ai_state, dict) else {}
    hard_max = intensity_tol.get("hard_sessions_per_week_max")

    volume_tol = (ai_state.get("volume_tolerance") or {}) if isinstance(ai_state, dict) else {}
    weekly_min = volume_tol.get("weekly_minutes_min")
    weekly_max = volume_tol.get("weekly_minutes_max")

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- Weekly target from WEEK META: planned_minutes ≈ {planned_minutes} min.\n"
            "  Free sessions total duration should roughly fit the week intent.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = (
            "- Volume preference: prefs.volume.mode='weekly_hours'. "
            f"Target weekly volume ≈ {volume_value * 60:.0f} min.\n"
        )
    elif isinstance(weekly_min, (int, float)) or isinstance(weekly_max, (int, float)):
        weekly_volume_line = "- Weekly volume tolerance exists in athlete_state.ai_state.volume_tolerance.\n"
    else:
        weekly_volume_line = "- Weekly volume not explicitly specified; infer from recent_load.\n"

    avoid_two_a_day_str = (
        "- Do NOT schedule two-a-day sessions.\n"
        if avoid_two_a_day
        else "- Two-a-day is allowed only when open_slots==2.\n"
    )
    avoid_back_to_back_hard_str = (
        "- Do NOT schedule two hard sessions on consecutive days.\n"
        if avoid_back_to_back_hard
        else "- Avoid back-to-back hard days when possible.\n"
    )

    strength_str = f"{strength_target_int}× per week" if strength_target_int else "no explicit target"
    hard_str = (
        f"max {hard_max} hard sessions / week (including high-intensity external events)"
        if hard_max
        else "not specified"
    )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week. "
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
  "schema_version": 2,
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

    if fixed_slots:
        context_for_ai["fixed_slots_debug"] = fixed_slots

    if not has_day_constraints:
        fallback_block = (
            "\nFALLBACK MODE (day_constraints missing):\n"
            "- Create 7 days from week_start..week_end.\n"
            "- Place weekly_template HARD slots on their weekdays.\n"
            "- Fill remaining days reasonably.\n"
        )
        _dprint("build_prompts: FALLBACK MODE active (day_constraints missing/empty)")
    else:
        fallback_block = ""

    user_txt = (
        "Generate FREE sessions for exactly one calendar week based on the context JSON.\n"
        "Locked sessions will be injected by the server; you must NOT output locks.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start or 'unknown'} .. {week_end or 'unknown'}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"Preferred days off (soft prefs): {days_off_str}\n"
        f"Preferred long run days: {long_run_days_str}\n"
        f"{weekly_template_reference_line}"
        f"{skeleton_rules}\n"
        f"{preference_semantics}\n"
        f"{fixed_payload_rules}\n"
        f"{explanation_rule}\n"
        f"Strength training target: {strength_str}\n"
        f"Intensity limit: {hard_str}\n"
        f"{weekly_volume_line}"
        "STRENGTH SLOTS (concept only, not concrete exercises):\n"
        + strength_slots_desc
        + "\n\nSTRENGTH QUALITY RULES:\n"
        + "- If you output a strength session: keep it simple; server will normalize and mapper will add exercises.\n"
        + "\n\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + fallback_block
        + "\n\nHard requirements:\n"
        + "- Always return a single JSON object matching the schema.\n"
        + f"- All free text MUST be written in {lang_label} and address the athlete directly in 2nd person. {second_person_note}\n"
        + "- Output days MUST match day_constraints dates exactly (same count, same order).\n"
        + "- For each date, number of sessions MUST equal open_slots for that date.\n"
        + "- Do NOT output locks.\n"
        + "- Do NOT invent extreme workloads.\n"
        + avoid_two_a_day_str
        + avoid_back_to_back_hard_str
        + "- Avoid scheduling a hard run workout on the day immediately after a team sport external event.\n"
    )

    # Debug: prompt sizes (toto je často root-cause keď model začne halucinovať / skracovať)
    _dprint("prompt sizes: system_chars=", len(system_txt), "| user_chars=", len(user_txt))
    try:
        # nech aspoň vidíš, či tam fakt ide day_constraints a open_slots
        dc = context_for_ai.get("day_constraints") or []
        _dprint("context_for_ai: day_constraints_count=", (len(dc) if isinstance(dc, list) else "na"))
    except Exception:
        pass

    return system_txt, user_txt, fixed_slots, strength_target_int