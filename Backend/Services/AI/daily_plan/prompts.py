from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

def _safe_int(v: Any, default: int = 0, *, min_v: Optional[int] = None, max_v: Optional[int] = None) -> int:
    try:
        if v is None: out = default
        elif isinstance(v, (int, float)): out = int(v)
        elif isinstance(v, str):
            s = v.strip()
            out = int(float(s)) if s else default
        else: out = int(v)
    except Exception:
        out = default

    if min_v is not None and out < min_v: out = min_v
    if max_v is not None and out > max_v: out = max_v
    return out

def _as_dict(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}

def _get_dict(d: Dict[str, Any], key: str) -> Dict[str, Any]:
    val = d.get(key)
    return val if isinstance(val, dict) else {}

def _flatten_prefs(raw_prefs: Any) -> Dict[str, Any]:
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        return raw_prefs["value"]
    return raw_prefs if isinstance(raw_prefs, dict) else {}

def _remove_empty(d: Any) -> Any:
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d

def minify_daily_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    context = dict(context) if isinstance(context, dict) else {}
    ctx2: Dict[str, Any] = {}
    
    for k in ("week", "zones", "thresholds", "external_events", "latest_paces", "recent_load", "recovery"):
        if k in context:
            ctx2[k] = context[k]

    raw_prefs = context.get("prefs") or {}
    prefs_val = raw_prefs.get("value")
    prefs = dict(prefs_val) if isinstance(prefs_val, dict) else dict(raw_prefs) if isinstance(raw_prefs, dict) else {}

    preferences = _get_dict(prefs, "preferences")
    volume = _get_dict(prefs, "volume")
    targets = _get_dict(prefs, "targets")

    # 👇 OPRAVA: Dynamické vytiahnutie cieľov a pretekov pre AKÝKOĽVEK šport (run, bike, swim, atď.)
    ctx_targets = {}
    for sport_key, sport_val in targets.items():
        if not isinstance(sport_val, dict):
            continue
        
        if sport_key == "strength":
            ctx_targets["strength"] = {
                "focus": sport_val.get("focus"),
                "sessions_per_week": sport_val.get("sessions_per_week"),
            }
        else:
            # Tu sa zachytí run, bike, swim, triathlon a všetko ostatné
            ctx_targets[sport_key] = {
                "race_goal": sport_val.get("race_goal"),
                "race_type": sport_val.get("race_type"),
                "target_time": sport_val.get("target_time"),
                "races": sport_val.get("races") # Presunie races pre daný šport
            }

    ctx2["prefs"] = {
        "main_sport": prefs.get("main_sport"),
        "add_on_sports": prefs.get("add_on_sports"),
        "included_sports": prefs.get("included_sports"),
        "goal_kind": prefs.get("goal_kind"),
        "volume": {"mode": volume.get("mode"), "value": volume.get("value")} if volume else {},
        "preferences": {
            "days_off": preferences.get("days_off"),
            "long_run_days": preferences.get("long_run_days"),
            "avoid_two_a_day": preferences.get("avoid_two_a_day"),
            "avoid_back_to_back_hard": preferences.get("avoid_back_to_back_hard"),
        } if preferences else {},
        "targets": ctx_targets if targets else {},
    }

    athlete_state = context.get("athlete_state")
    if isinstance(athlete_state, dict):
        is_beginner = athlete_state.get("is_returning_beginner")
        ai_state = athlete_state.get("ai_state") or {}
        if isinstance(ai_state, dict):
            ai_state_clean = dict(ai_state)
            ai_state_clean.pop("metrics", None)
            ctx2["athlete_state"] = {
                "ai_state": ai_state_clean,
                "user_summary": athlete_state.get("user_summary"),
                "is_returning_beginner": is_beginner
            }

    ext = context.get("external_events")
    if isinstance(ext, dict):
        events: List[Dict[str, Any]] = []
        if isinstance(ext.get("events"), list):
            events = [e for e in ext.get("events", []) if isinstance(e, dict)]
        else:
            win = ext.get("window")
            if isinstance(win, dict) and isinstance(win.get("events"), list):
                events = [e for e in win.get("events", []) if isinstance(e, dict)]

        cleaned_events: List[Dict[str, Any]] = []
        for e in events:
            dt = e.get("occurrence_date") or e.get("date") or e.get("start_date_local") or e.get("start_date") or e.get("start_date_iso")
            dt_ymd = str(dt)[:10] if dt else None
            dft = e.get("days_from_today")
            
            if dt_ymd is None and isinstance(dft, (int, float)):
                cleaned_events.append({
                    "days_from_today": int(dft), "sport": e.get("sport"), "duration_min": e.get("duration_min"),
                    "priority": e.get("priority"), "title": e.get("title"),
                })
                continue
            if not dt_ymd: continue
            cleaned_events.append({
                "occurrence_date": dt_ymd, "sport": e.get("sport"), "duration_min": e.get("duration_min"),
                "priority": e.get("priority"), "title": e.get("title"),
            })

        win2 = ext.get("window")
        if isinstance(win2, dict):
            ctx2["external_events"] = {
                "window": {
                    "from": str(win2.get("from"))[:10] if win2.get("from") else None,
                    "to": str(win2.get("to"))[:10] if win2.get("to") else None,
                    "events": cleaned_events,
                }
            }
        else:
            ctx2["external_events"] = {"events": cleaned_events}

    for k in ("week_meta", "replan_trigger", "generate_reason", "is_replan", "planning_constraints"):
        if k in context: ctx2[k] = context[k]

    return _remove_empty(ctx2)


def _format_pace(seconds_per_km: int) -> str:
    if not isinstance(seconds_per_km, (int, float)) or seconds_per_km <= 0:
        return ""
    minutes = int(seconds_per_km) // 60
    seconds = int(seconds_per_km) % 60
    return f"{minutes}:{seconds:02d}"

def build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, List[Dict[str, Any]], Optional[int]]:
    
    settings = settings or {}
    lang_code = str(settings.get("language") or "sk").lower()
    
    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = "Always speak directly to the athlete and use 'you'."
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Vždy mluv přímo k atletovi a používej 2. osobu."
    else:
        lang_label = "Slovak"
        second_person_note = "Vždy hovor priamo k atlétovi a používej 2. osobu."

    week = _get_dict(context_payload, "week")
    prefs = _flatten_prefs(context_payload.get("prefs") or {})
    
    constraints = _get_dict(context_payload, "planning_constraints")
    is_returning_beginner = bool(constraints.get("is_returning_beginner"))

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"
    
    add_on = prefs.get("add_on_sports")
    included = prefs.get("included_sports")

    sports_set = {main_sport}
    if isinstance(add_on, list):
        for s in add_on:
            if isinstance(s, str) and s: sports_set.add(s.lower())
    elif isinstance(included, list):
        for s in included:
            if isinstance(s, str) and s: sports_set.add(s.lower())

    final_sports_list = list(sports_set)

    pref_obj = _get_dict(prefs, "preferences")

    days_off = pref_obj.get("days_off") or []
    if isinstance(days_off, list):
        days_off = [str(d) for d in days_off if isinstance(d, str) and d.strip()]
    else:
        days_off = []

    two = _get_dict(pref_obj, "two_a_day")
    two_enabled = bool(two.get("enabled"))
    two_cap = _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2) if two_enabled else 0

    long_run_days = pref_obj.get("long_run_days") or []
    if isinstance(long_run_days, list):
        long_run_days = [str(d) for d in long_run_days if isinstance(d, str) and d.strip()]
    else: long_run_days = []

    avoid_back_to_back = bool(pref_obj.get("avoid_back_to_back_hard"))
    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"
    
    zones_data = _as_dict(context_payload.get("zones"))
    has_zones = False
    for key, val in zones_data.items():
        if isinstance(val, dict):
            if val.get("z1_min") is not None or val.get("z1_max") is not None:
                has_zones = True
                break
            z_list = val.get("zones")
            if isinstance(z_list, list) and len(z_list) > 0:
                has_zones = True
                break
        elif key in ["z1_min", "z1_max"] and val is not None:
            has_zones = True
            break

    tb = _get_dict(pref_obj, "training_blocks")

    blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    strength_settings = _get_dict(prefs, "strength_settings")
    strength_target_int: Optional[int] = None
    ss_raw = strength_settings.get("sessions_per_week")
    if isinstance(ss_raw, (int, float, str)):
        try: strength_target_int = int(ss_raw)
        except Exception: pass
    
    ext = _as_dict(context_payload.get("external_events"))
    ext_occ = ext.get("occurrences")
    if not isinstance(ext_occ, list): ext_occ = []
    ext_count = len(ext_occ)
    ext_minutes_total = sum(_safe_int(e.get("duration_min"), 0) for e in ext_occ if isinstance(e, dict))

    volume_prefs = _get_dict(prefs, "volume")
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    if isinstance(planned_minutes, (int, float)):
        rem = max(0, int(planned_minutes) - ext_minutes_total)
        weekly_volume_line = f"- WEEKLY VOLUME: The ultimate plan target is {planned_minutes} min. External events: {ext_minutes_total} min. HOWEVER, CRITICAL: You MUST strictly respect the safe upper limit defined in `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. Do NOT exceed this safe limit under any circumstances!\n"
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        tgt = int(volume_value * 60)
        rem = max(0, tgt - ext_minutes_total)
        weekly_volume_line = f"- WEEKLY VOLUME: The athlete's long-term goal is {tgt} min/week. External events: {ext_minutes_total} min. HOWEVER, CRITICAL: You MUST strictly respect the safe upper limit defined in `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. Do NOT exceed this safe limit under any circumstances! Check their recent_load to avoid dangerous volume spikes.\n"
    else:
        weekly_volume_line = "- WEEKLY VOLUME: Infer from recent_load, count external events, and DO NOT exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`.\n"

    back_to_back_rule = (
        "- AVOID BACK-TO-BACK HARD: YES (Strict).\n" if avoid_back_to_back
        else "- AVOID BACK-TO-BACK HARD: Soft preference.\n"
    )

    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = f"{strength_target_int}× per week" if strength_target_int is not None else "not specified"
    
    days_off_str = ", ".join(days_off) if days_off else ""
    if days_off_str:
        rest_days_rule = (
            f"- REST DAYS (CRITICAL): The user explicitly requested these days off: {days_off_str}. "
            "You MUST schedule ONLY a complete 'rest' on these days (sport='other', kind='rest', duration_min=0). No exceptions.\n\n"
        )
    else:
        rest_days_rule = (
            "- REST DAYS & SPACING (CRITICAL): The user did NOT select explicit days off. "
            "You MUST forcefully keep AT LEAST 1 DAY completely free of any training! "
            "On a rest day, provide exactly one session with sport='other', kind='rest', duration_min=0. "
            "CRITICAL SPACING: DO NOT schedule more than 3 consecutive days of training without a rest day! Spread the rest days logically.\n\n"
        )

    if two_enabled and two_cap > 0:
        two_a_day_rule = (
            f"- TWO-A-DAY / GROUPING: Max {two_cap} days/week can have 2 sessions. "
            "Use this capability to group sessions (e.g. Run + Strength) to free up days for complete rest.\n\n"
        )
    else:
        two_a_day_rule = (
            "- TWO-A-DAY / GROUPING (CRITICAL): Max 0 days/week can have 2 sessions. "
            "You are FORBIDDEN from scheduling 2 sessions on the same day. "
            "If you have more requested workouts than available training days, you MUST DROP some sessions. NEVER train 7 days a week!\n\n"
        )
    
    strength_rule = (
        f"- STRENGTH: Target {strength_str}. Use sport='strength'. "
        "CRITICAL: If 'two_a_day' is disabled and you lack days to fit all sessions, REDUCE the number of strength sessions. DO NOT sacrifice rest days.\n\n"
    )

    long_run_rule = f"- LONG RUN: If run is main sport, 1 long run (pref: {long_run_days_str}).\n\n"

    multi_sport_rule = ""
    if len(final_sports_list) > 1:
        other_sports = [s for s in final_sports_list if s != main_sport and s != "strength"]
        if other_sports:
            multi_sport_rule = (
                f"- MULTI-SPORT: Athlete sports: {', '.join(final_sports_list)}. "
                f"Schedule {', '.join(other_sports)} sessions too. Balanced plan.\n\n"
            )
            
    beginner_rule = ""
    if is_returning_beginner:
        beginner_rule = (
            "- BEGINNER / RETURNING ATHLETE PROTOCOL (CRITICAL):\n"
            "  The user has NO recent activity. They are unfamiliar with technical terms.\n"
            "  - You MUST explain intensity using human feeling (Talk Test).\n"
            "  - MANDATORY CUES for Run and Ride:\n"
            "    * 'Talk Test': You should be able to speak in full sentences without gasping.\n"
            "    * 'Sing Test': If you can hum or sing, the pace is perfect.\n"
            "  - FOR BIKE: Emphasize 'Cadence over Power' (keep pedaling easy).\n"
            "  - Emphasize WHY: 'Adaptation of joints and tendons takes more time than muscles.'\n\n"
        )

    system_txt = (
        "You are an elite endurance coaching assistant. "
        "Your task is to design a detailed DAILY training plan for the current week. "
        "Return ONE valid JSON object only. Do NOT output prose or markdown."
    )

    schema_text = f"""
{{
  "schema_version": 2,
  "days": [
    {{
      "plan_date": "YYYY-MM-DD",
      "weekday": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
      "sessions": [
        {{
          "sport": "run" | "ride" | "swim" | "strength" | "other" | "rest",
          "kind": "easy" | "long" | "interval" | "tempo" | "recovery" | "race" | "mobility" | "rest" | "other",
          "title": "Descriptive title in {lang_label} (e.g. 'Silový tréning - Nohy a Core', 'Prahový beh')",
          "duration_min": number,
          "distance_km": number, // OMIT if null
          "tss_estimate": number, // OMIT if null
          "notes": "REQUIRED. 1-2 short sentences in {lang_label} describing the main purpose of this session.",
          "session_type": "external_event" | null,
          "structure": {{ // Omit if basic rest or other
            "warmup": {{ "minutes": number, "notes": "MUST INCLUDE Target HR (bpm) AND Pace/Power. max 2 sentences." }},
            
            // Use this object inside the array for steady endurance/tempo runs:
            // {{"minutes": number, "notes": "Target HR + Pace/Power"}}
            // OR use this interval block inside the array if the run is an interval session:
            // {{"kind": "interval_block", "repeats": number, "work": {{"minutes": number, "notes": "Target HR + Pace"}}, "rest": {{"minutes": number, "notes": "Recovery HR + Pace"}}}}
            "main_part": [ object ], 
            
            "cooldown": {{ "minutes": number, "notes": "MUST INCLUDE Target HR (bpm) AND Pace/Power. max 2 sentences." }},
            
            "activation": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ], // Strength only
            "strength_main_part": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ], // Strength only
            "add_ons": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ] // Strength only
          }}
        }}
      ]
    }}
  ]
}}
""".strip()

    date_integrity_rule = "- DATE INTEGRITY: Use only dates inside the given Week range.\n\n"
    
    external_rules = (
        "- EXTERNAL EVENTS (CRITICAL PRIORITY - OVERRIDE EVERYTHING ELSE): You MUST check the `external_events` object in the context. "
        "If there are any events (e.g. Football on Wednesday), YOU MUST schedule a session on that exact date. "
        "For these events, you MUST set `sport`=\"other\", `kind`=\"other\" AND `session_type`=\"external_event\". "
        "DO NOT IGNORE EXTERNAL EVENTS under any circumstances. If the external event makes the day too crowded, drop other scheduled workouts, but NEVER drop the external event.\n\n"
    )

    # 👇 UPRAVENÉ PRAVIDLO PRE PRETEKY: Zvládne kontrolu vo VŠETKÝCH športoch!
    race_scheduling_rule = (
        "- RACE SCHEDULING (CRITICAL):\n"
        "  1. Check `external_events` AND any `races` arrays inside `prefs.targets` (e.g., `prefs.targets.run.races`, `prefs.targets.bike.races`, etc.). If there is a real race with an exact date in THIS current week, you MUST schedule it on that exact date.\n"
        "  2. If there are NO exact-date races scheduled for this week in the context, you are STRICTLY FORBIDDEN from inventing random race days (`kind`='race').\n"
        "  3. EXCEPTION: If there are NO exact-date races defined in `prefs` at all, but the user has a race goal, you may schedule a 'Virtual Race' (Virtuálny pretek) ONLY at the end of the final week of the entire training macrocycle. In any other regular training week, NO FAKE RACES.\n\n"
    )

    latest_paces = _as_dict(context_payload.get("latest_paces"))
    if has_zones:
        pace_instructions = ""
        if any(latest_paces.get(k) for k in ["z1_pace_s", "z2_pace_s", "z3_pace_s", "z4_pace_s", "z5_pace_s"]):
            pace_str_parts = []
            for i in range(1, 6):
                key = f"z{i}_pace_s"
                val = latest_paces.get(key)
                if val is not None:
                    pace_str_parts.append(f"Z{i}: {_format_pace(val)}")
            
            if pace_str_parts:
                pace_instructions = (
                    f"CRITICAL: When prescribing Pace for running, strictly use the following reference from user preferences: "
                    f"{', '.join(pace_str_parts)}. Do not deviate by more than 5-10 seconds per km unless the session is specifically hilly or trail-based.\n"
                )
        else:
            pace_instructions = (
                "CRITICAL: No specific pace history found. You must ESTIMATE realistic target paces based on the user's recent load, target race time, and athlete state capabilities. "
                "Provide a realistic average pace (min/km) for the specific zone being targeted, not max pace. Keep it conservative.\n"
            )

        intensity_format_rule = (
            "- INTENSITY FORMATTING (HAS ZONES): "
            "In `notes` fields for `warmup`, `main_part` (or `work`/`rest`), and `cooldown`, ALWAYS include BOTH a specific Target Heart Rate range (use 'bpm') AND Pace (min/km) or Power (W). "
            "CRITICAL INSTRUCTION FOR HEART RATE: The zones in context_payload.zones are your absolute BOUNDARIES for zones. "
            "DO NOT output the entire width of the zone (e.g., if Z1 is 0-154 bpm, do NOT write '0-154 bpm'). "
            "Instead, prescribe a narrower, realistic target range (e.g., a 10-15 bpm window like '135-150 bpm') that fits strictly WITHIN the user's specific zone limits. "
            "NEVER use generic human heart rates; strictly respect the user's minimum and maximum bounds for each zone. "
            "Example Format: 'Z2 (145-155 bpm) @ [insert pace] min/km'. "
            f"{pace_instructions}\n"
        )
    else:
        intensity_format_rule = (
            "- INTENSITY FORMATTING (NO ZONES): "
            "In `notes` fields for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH RPE AND Pace (min/km) or Power (W). "
            "Example Format: 'RPE 3/10 @ 6:00-6:30 min/km'. "
            "CRITICAL: Keep paces realistic and lean towards SLOWER, more conservative paces for easy runs, warmups, and cooldowns.\n\n"
        )

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (RUN & RIDE): For every running and cycling session, "
        "provide a detailed `structure` object using `warmup`, `main_part`, and `cooldown`.\n"
        "  - If it is a steady run, `main_part` is an array of objects with `minutes` and `notes`.\n"
        "  - If it is an interval session, use the `interval_block` format inside the `main_part` array.\n\n"
    )

    strength_structure_rule = (
        "- STRENGTH STRUCTURE: When creating a 'strength' session, use the provided 'strength_ai_menu'. "
        "Use ONLY the specific 'exercise_id' values. Distribute the exercises into 'activation' (1-2 exercises), "
        "'strength_main_part' (3-5 heavy exercises), and 'add_ons' (1-3 core/accessory exercises).\n"
        "  - MUST include a descriptive 'title' reflecting the focus (e.g. 'Silový tréning - Nohy a Core').\n\n"
    )

    intensity_model_rule = f"- INTENSITY MODEL: {intensity_model}. Use Zones: {has_zones}\n\n"
    blocks_rule = f"- TRAINING BLOCKS: {', '.join([k for k,v in blocks.items() if v]) or 'none'}.\n\n"

    context_for_ai = minify_daily_context_for_ai(context_payload)

    reason = context_payload.get("generate_reason")
    special_reason_rule = ""
    
    if reason == "health_mild_restriction":
        special_reason_rule = (
            "\n--- CRITICAL HEALTH RESTRICTION (MILD INJURY / ILLNESS) ---\n"
            "- The athlete reported a mild health issue or is recovering.\n"
            "- YOU MUST SIGNIFICANTLY REDUCE INTENSITY AND VOLUME for this week.\n"
            "- DO NOT schedule any VO2Max, Threshold or heavy Sprint intervals.\n"
            "- ALL sessions MUST be easy (Z1/Z2 or RPE 2-4/10) or active recovery.\n"
            "- Add extra REST days if the load seems heavy.\n"
            "- CRITICAL: Cap ALL session durations to a maximum of 40-50 minutes. NO long runs! \n" 
        )
    elif reason == "manual_review":
        special_reason_rule = (
            "\n--- ATHLETE REQUESTED ADJUSTMENT ---\n"
            "- The athlete requested a manual plan evaluation via Activity Review.\n"
            "- Look at their latest Activity Review comments in 'athlete_state' to see what they struggled with and adjust the upcoming sessions accordingly.\n"
        )
    elif reason == "soften":
         special_reason_rule = (
            "\n--- FATIGUE / SOFTEN REQUEST ---\n"
            "- The athlete's recent load is too high, or they are fatigued.\n"
            "- YOU MUST soften the remaining days of this week.\n"
            "- Replace hard intervals with easy endurance rides/runs or active recovery.\n"
        )
    elif reason in ["health_resolved", "health_resolved_return", "return_to_training"]:
        special_reason_rule = (
            "\n--- ⚠️ RETURN TO TRAINING (RECOVERED) ⚠️ ---\n"
            "- The athlete HAS JUST RECOVERED from a significant illness or injury.\n"
            "- CRITICAL: DO NOT schedule ANY high intensity (No VO2Max, No Threshold, No Sprints, No Z4/Z5).\n"
            "- CRITICAL: ONLY schedule Z1/Z2 (Aerobic / Recovery) sessions for the ENTIRE week.\n"
            "- Provide EXTRA REST DAYS (e.g. 3 rest days instead of 1).\n"
            "- Ignore their usual Strength training goals if needed to keep the overall load very light.\n"
            "- Regarding EXTERNAL EVENTS (like Football): You MUST still include them on their scheduled dates, BUT add a strong warning in the `notes` that the athlete should participate ONLY at a very low intensity (Zone 1/2) or skip it completely if they don't feel 100% recovered.\n"
            "- Their body is still fragile. A 'Threshold run' right after being sick is a terrible coaching mistake.\n"
        )

    elif reason == "refill_auto_extend":
        special_reason_rule = (
            "\n--- ⚠️ PARTIAL WEEK REFILL (CRITICAL) ⚠️ ---\n"
            "- You are generating workouts for a week that is ALREADY PARTIALLY COMPLETED.\n"
            "- You MUST look at the athlete's 'recent_load' and determine what they have already done THIS week.\n"
            "- CRITICAL: Your task is ONLY to generate workouts for the REMAINING days of this week to reach the weekly 'planned_minutes' and 'goal'.\n"
            "- Do NOT schedule a Long Run if they already did one this week. Do NOT schedule hard intervals if they already did them.\n"
            "- Only provide the missing puzzle pieces.\n"
        )

    user_txt = (
        "Generate a weekly plan.\n"
        f"Week: {week_index} ({week_start} .. {week_end})\n"
        f"Main Sport: {main_sport}\n"
        f"All Sports: {', '.join(final_sports_list)}\n"
        f"External events: {ext_count}\n\n"
        + date_integrity_rule
        + external_rules
        + race_scheduling_rule
        + rest_days_rule     
        + two_a_day_rule     
        + beginner_rule
        + long_run_rule      
        + multi_sport_rule
        + strength_rule      
        + intensity_format_rule
        + endurance_structure_rule 
        + strength_structure_rule
        + intensity_model_rule
        + blocks_rule
        + weekly_volume_line
        + back_to_back_rule
        + special_reason_rule 
        + "\n--- STRICT CONCISENESS RULE ---\n"
        + "- EXTREME EFFICIENCY: OMIT any optional fields (distance_km, tss_estimate, warmup_min, cooldown_min) if their value would be null. Do NOT output keys with null values.\n"
        + "- Session 'title' and 'notes' are REQUIRED for every session. Make titles descriptive.\n"
        + "- Keep strength exercise notes to max 5 words.\n"
        + "- DO NOT write long explanations. Be punchy and direct.\n"
        + "- DO NOT exceed 8000 tokens in output.\n"
        + "\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + schema_text
        + "\n\nRequirements:\n"
        + "- Single valid JSON matching schema.\n"
        + f"- Language: {lang_label}, address user as 'you' ({second_person_note}).\n"
        + "- Do NOT invent extreme workloads. ALWAYS check recent_load to avoid huge volume spikes!\n"
        + "- OUTPUT FORMATTING: Return ONLY valid JSON. Do not output any markdown formatting like ```json, and absolutely NO conversational text, explanations, or lists before or after the JSON.\n"
    )

    return system_txt, user_txt, [], strength_target_int
