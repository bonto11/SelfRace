# ===== PROMPTS (tvoj súbor s _build_prompts_for_daily) =====
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
    """
    Z weekly_template vyberie sloty s priority == "key".

    - ai_can_move == False -> HARD fixed (coach má držať konkrétny deň)
    - ai_can_move == True  -> SOFT preferred

    Vracia list objektov:
      {
        "weekday": "Tue",
        "sport": "strength",
        "kind": "full",
        "priority": "key",
        "ai_can_move": False,
        "policy": "hard" | "soft"
      }
    """
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

            priority = s.get("priority")
            if priority != "key":
                continue

            sport = s.get("sport")
            kind = s.get("kind")
            if not (day_name and sport and kind):
                continue

            ai_can_move_val = s.get("ai_can_move")
            # default bezpečne: ak nie je zadané, ber to ako SOFT
            hard = (ai_can_move_val is False)

            fixed.append(
                {
                    "weekday": str(day_name),  # "Tue", "Fri", "Sat"
                    "sport": str(sport),
                    "kind": str(kind),
                    "priority": str(priority),
                    "ai_can_move": bool(ai_can_move_val)
                    if ai_can_move_val is not None
                    else True,
                    "policy": "hard" if hard else "soft",
                }
            )

            if len(fixed) >= max_fixed:
                return fixed

    return fixed


def _minify_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orezaný context pre LLM – len veci potrebné na plán.
    """
    ctx2: Dict[str, Any] = {}

    if "week" in ctx:
        ctx2["week"] = ctx["week"]
    if "zones" in ctx:
        ctx2["zones"] = ctx["zones"]
    if "thresholds" in ctx:
        ctx2["thresholds"] = ctx["thresholds"]
    if "recent_load" in ctx:
        ctx2["recent_load"] = ctx["recent_load"]

    # prefs flatten
    raw_prefs = ctx.get("prefs") or {}
    if (
        isinstance(raw_prefs, dict)
        and "value" in raw_prefs
        and isinstance(raw_prefs["value"], dict)
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    prefs2: Dict[str, Any] = {
        "main_sport": prefs.get("main_sport"),
        "start_date": prefs.get("start_date"),
        "preferences": prefs.get("preferences") or {},
    }

    if "volume" in prefs:
        prefs2["volume"] = prefs.get("volume")
    if "weeks" in prefs:
        prefs2["weeks"] = prefs.get("weeks")
    if "strength_settings" in prefs:
        prefs2["strength_settings"] = prefs.get("strength_settings")

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

    if "external_events" in ctx:
        ctx2["external_events"] = ctx["external_events"]
    if "last_activities" in ctx:
        ctx2["last_activities"] = ctx["last_activities"]

    if "user_settings" in ctx:
        ctx2["user_settings"] = ctx["user_settings"]

    return ctx2


def _build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, List[Dict[str, Any]], Optional[int]]:
    """
    Vráti (system_prompt, user_prompt, fixed_slots, strength_target).

    Poznámka:
    - fixed_slots posielame do AI ako štruktúrovanú informáciu.
    - HARD enforcement na 100% (ak chceš) sa robí až server-side postprocessingom,
      ale tento prompt už HARD pravidlo jasne vyžaduje.
    """
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = (
            "Always speak directly to the athlete and use 'you' instead of 'the athlete' or 'he/she'."
        )
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Vždy mluv přímo k atletovi a používej 2. osobu ('ty' / 'vy'), nikdy nepiš 'atlet by měl…'."
    else:
        lang_label = "Slovak"
        second_person_note = "Vždy hovor priamo k atlétovi a používaj 2. osobu ('ty'), nikdy nepiš 'atlét by mal…'."

    week = context_payload.get("week") or {}

    # prefs flatten
    raw_prefs = context_payload.get("prefs") or {}
    if (
        isinstance(raw_prefs, dict)
        and "value" in raw_prefs
        and isinstance(raw_prefs["value"], dict)
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
    main_sport = prefs.get("main_sport") or "run"

    pref_obj = prefs.get("preferences") or {}
    days_off = pref_obj.get("days_off") or []
    long_run_days = pref_obj.get("long_run_days") or []
    avoid_two_a_day = bool(pref_obj.get("avoid_two_a_day"))
    avoid_back_to_back_hard = bool(pref_obj.get("avoid_back_to_back_hard"))

    weekly_template = (
        prefs.get("weekly_template") or context_payload.get("weekly_template") or {}
    )
    wt_mode = weekly_template.get("mode") or "off"
    fixed_slots = _derive_fixed_slots(weekly_template, max_fixed=7)

    # ---- weekly template instructions (HARD vs SOFT) ----
    if wt_mode == "off" or not fixed_slots:
        weekly_template_line = (
            "- Weekly template: none. Use only days_off, long_run_days "
            "and external events to distribute the week.\n"
        )
    else:
        hard_slots = [fs for fs in fixed_slots if fs.get("policy") == "hard"]
        soft_slots = [fs for fs in fixed_slots if fs.get("policy") != "hard"]

        hard_human = (
            "; ".join(
                f"{fs['weekday']}: {fs['sport']}/{fs['kind']}" for fs in hard_slots
            )
            if hard_slots
            else "none"
        )
        soft_human = (
            "; ".join(
                f"{fs['weekday']}: {fs['sport']}/{fs['kind']}" for fs in soft_slots
            )
            if soft_slots
            else "none"
        )

        weekly_template_line = (
            "- Weekly template days are provided in two levels:\n"
            f"  HARD FIXED slots (ai_can_move=false): {hard_human}\n"
            f"  SOFT preferred slots (ai_can_move=true): {soft_human}\n"
            "\n"
            "- HARD FIXED rule:\n"
            "  For every HARD fixed slot that falls within this week, you MUST place a session of that sport/kind on that exact weekday.\n"
            "  If doing the planned workout there would be a bad idea (fatigue, recovery, clash with a high-intensity external event),\n"
            "  you STILL keep the slot on that day, but you must soften it into a safer alternative.\n"
            "  In that case set session_type='coach_override' and explain in notes why you softened/changed it.\n"
            "\n"
            "- SOFT preferred rule:\n"
            "  Prefer these weekdays when it makes sense, but you may move them if recovery or external events require it.\n"
            "\n"
            "- REQUIRED FIXED SLOT TAGGING:\n"
            "  Any session scheduled because of a fixed slot MUST include payload.fixed_slot:\n"
            "  {weekday, sport, kind, policy}.\n"
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

    plan_adj = ai_state.get("plan_adjustment") or {}
    soften_block = plan_adj.get("soften_next_days") or {}
    soften_flag = bool(soften_block.get("should_soften"))
    soften_days = soften_block.get("days")
    soften_reason = soften_block.get("reason")

    if soften_flag:
        if isinstance(soften_days, int) and soften_days > 0:
            soften_line = (
                "- Plan adjustment: `soften_next_days.should_soften` is true.\n"
                f"  → In this week, clearly soften the first ~{soften_days} calendar days after week_start.\n"
            )
        else:
            soften_line = (
                "- Plan adjustment: `soften_next_days.should_soften` is true.\n"
                "  → Soften at least the first 2–3 days after week_start.\n"
            )
        if soften_reason:
            soften_line += f"  Reason from AI state: {soften_reason}\n"
    else:
        soften_line = ""

    replan_flag = bool(plan_adj.get("should_replan_weekly"))
    weekly_replan_reason = plan_adj.get("weekly_replan_reason")
    if replan_flag:
        replan_line = (
            "- Plan adjustment: `should_replan_weekly` is true.\n"
            "  → Treat this as a conservative, corrective week.\n"
        )
        if weekly_replan_reason:
            replan_line += f"  Reason from AI state: {weekly_replan_reason}\n"
    else:
        replan_line = ""

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

    strength_target = (targets.get("strength") or {}).get("sessions_per_week")
    strength_str = (
        f"{strength_target}× per week" if strength_target else "no explicit target"
    )

    hard_str = (
        f"max {hard_max} hard sessions / week (including high-intensity external sports events)"
        if hard_max
        else "not specified"
    )

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- Weekly target from WEEK META: planned_minutes ≈ {planned_minutes} min. "
            "Total duration_min in the week should be close to this (±15%).\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = (
            "- Volume preference: prefs.volume.mode = 'weekly_hours'. "
            f"Target weekly volume ≈ {volume_value * 60:.0f} min.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "daily_minutes":
        weekly_volume_line = "- Volume preference: prefs.volume.mode = 'daily_minutes'.\n"
    elif isinstance(weekly_min, (int, float)) or isinstance(weekly_max, (int, float)):
        weekly_volume_line = "- Weekly volume tolerance is defined in athlete_state.ai_state.volume_tolerance.\n"
    else:
        weekly_volume_line = "- Weekly volume is not explicitly specified; infer it from recent_load.\n"

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week (meta, athlete state, prefs, zones, thresholds, external events). "
        "Your task is to generate DAY-BY-DAY training sessions for that week. "
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
          "targets"?: { "hr_bpm"?: [number, number] | null, "pace_min_per_km"?: string | null, "power_w"?: number | null },
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
        context_for_ai["fixed_slots"] = fixed_slots

    external_hint = (
        "- The context may contain an `external_events` block with concrete occurrences "
        "(fields `occurrence_date`, `sport`, `duration_min`, `priority`, `title`).\n"
        "- For every occurrence within [week_start, week_end], you MUST represent it as a session on that day.\n"
        "- Team sports such as football can be a hard session, but do not assume 90 minutes by default; "
        "use duration_min if available, otherwise prefer 45–60 min unless the context clearly implies more.\n"
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
        + "\n\nSTRENGTH QUALITY RULES (important):\n"
        "- If you schedule a strength session with kind='full', duration_min should be ~75 (±10).\n"
        "- A 'full' strength session MUST NOT be only 2–3 exercises.\n"
        "- For full strength, follow structure roughly:\n"
        "  warmup ~15 min (activation/mobility), main ~45 min, finish/cooldown ~15 min.\n"
        "- strength_exercises should include approximately:\n"
        "  2 activation (2–3 sets, 8–12 reps, rest 45–60s),\n"
        "  5 main (4 sets, 4–6 reps, rest 120s),\n"
        "  2 accessories (3 sets, 8–12 reps, rest 60s).\n"
        "- If a HARD fixed strength slot conflicts with recovery/external event, keep it that day but soften it:\n"
        "  set session_type='coach_override', reduce duration to 30–50, and explain why in notes.\n"
        + "\n\nPLAN ADJUSTMENT HINTS FROM ATHLETE STATE:\n"
        + soften_line
        + replan_line
        + "\nEXTERNAL EVENTS (fixed activities & life events):\n"
        + external_hint
        + "\n\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object matching the schema (you may set fields to null when unknown).\n"
        f"- All free text MUST be written in {lang_label} and address the athlete directly in 2nd person. {second_person_note}\n"
        "- Days must form a continuous sequence within [week_start, week_end].\n"
        "- For each day, `sessions` MUST be a non-empty array; rest day = one session with sport 'other' and session_type 'rest_day'.\n"
        "- Respect prefs.days_off and long_run_days.\n"
        "- Avoid scheduling a hard run workout on the same day as a clearly high-intensity external event.\n"
        "- HARD fixed slots (ai_can_move=false) are mandatory as described above; keep them on that weekday even if you must soften them.\n"
        f"{avoid_two_a_day_str}"
        f"{avoid_back_to_back_hard_str}"
        "- Use hard_sessions_per_week_max from athlete_state.ai_state.intensity_tolerance to cap total hard sessions (including external events).\n"
        "- If strength.sessions_per_week >= 1, schedule approximately that many strength sessions distributed through the week.\n"
        "- For strength sessions, use only the strength_exercises slot structure (slot, sets, reps, rest_s, notes).\n"
        "- Do NOT invent extreme workloads.\n"
    )

    return system_txt, user_txt, fixed_slots, strength_target