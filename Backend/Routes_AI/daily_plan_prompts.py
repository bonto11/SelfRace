from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

def _safe_int(
    v: Any, default: int = 0, *, min_v: Optional[int] = None, max_v: Optional[int] = None
) -> int:
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

def _minify_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    context2: Dict[str, Any] = {}
    
    for k in ("week", "zones", "thresholds", "external_events"):
        if k in context:
            context2[k] = context[k]

    prefs = _flatten_prefs(context.get("prefs") or {})
    pref_obj = prefs.get("preferences") or {}
    if not isinstance(pref_obj, dict): pref_obj = {}

    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"

    tb = pref_obj.get("training_blocks") or {}
    if not isinstance(tb, dict): tb = {}
    training_blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    context2["prefs"] = {
        "weeks": prefs.get("weeks"),
        "main_sport": prefs.get("main_sport"),
        "add_on_sports": prefs.get("add_on_sports"), 
        "included_sports": prefs.get("included_sports"), 
        "goal_kind": prefs.get("goal_kind"),
        "volume": prefs.get("volume"),
        "preferences": {
            **pref_obj,
            "intensity_model": intensity_model,
            "training_blocks": training_blocks,
        },
        "strength_settings": prefs.get("strength_settings") or {},
        "injuries": prefs.get("injuries") or [], 
    }

    athlete_state = context.get("athlete_state") or {}
    is_beginner = athlete_state.get("is_returning_beginner") 

    ai_state = athlete_state.get("ai_state") or {}
    if isinstance(ai_state, dict):
        ai_state_clean = dict(ai_state)
        ai_state_clean.pop("metrics", None)
        context2["athlete_state"] = {
            "ai_state": ai_state_clean,
            "is_returning_beginner": is_beginner
        }

    us = context.get("user_settings") or {}
    if isinstance(us, dict):
        context2["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }
    
    pc = context.get("planning_constraints")
    if isinstance(pc, dict):
        context2["planning_constraints"] = pc

    return _remove_empty(context2)

def build_prompts_for_daily(
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
        second_person_note = "Vždy hovor priamo k atlétovi a používej 2. osobu."

    week = context_payload.get("week") or {}
    prefs = _flatten_prefs(context_payload.get("prefs") or {})
    
    constraints = context_payload.get("planning_constraints") or {}
    is_returning_beginner = bool(constraints.get("is_returning_beginner"))

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"
    
    add_on = prefs.get("add_on_sports")
    included = prefs.get("included_sports")

    sports_set = set()
    sports_set.add(main_sport)

    if isinstance(add_on, list):
        for s in add_on:
            if isinstance(s, str) and s: sports_set.add(s.lower())
    elif isinstance(included, list):
        for s in included:
            if isinstance(s, str) and s: sports_set.add(s.lower())

    final_sports_list = list(sports_set)

    pref_obj = prefs.get("preferences") or {}
    if not isinstance(pref_obj, dict): pref_obj = {}

    two = pref_obj.get("two_a_day") or {}
    two_enabled = bool(two.get("enabled")) if isinstance(two, dict) else False
    two_cap = _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2) if two_enabled else 0

    long_run_days = pref_obj.get("long_run_days") or []
    if isinstance(long_run_days, list):
        long_run_days = [str(d) for d in long_run_days if isinstance(d, str) and d.strip()]
    else: long_run_days = []

    avoid_back_to_back = bool(pref_obj.get("avoid_back_to_back_hard"))
    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"
    has_zones = bool(pref_obj.get("use_zones", True))

    tb = pref_obj.get("training_blocks") or {}
    if not isinstance(tb, dict): tb = {}
    blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    strength_settings = prefs.get("strength_settings")
    if not isinstance(strength_settings, dict): strength_settings = {}
    
    strength_target_int: Optional[int] = None
    ss_raw = strength_settings.get("sessions_per_week")
    if isinstance(ss_raw, (int, float, str)):
        try: strength_target_int = int(ss_raw)
        except Exception: pass
    
    ext = context_payload.get("external_events") or {}
    ext_occ = ext.get("occurrences") if isinstance(ext, dict) else []
    if not isinstance(ext_occ, list): ext_occ = []
    ext_count = len(ext_occ)
    ext_minutes_total = sum(_safe_int(e.get("duration_min"), 0) for e in ext_occ if isinstance(e, dict))

    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode") if isinstance(volume_prefs, dict) else None
    volume_value = volume_prefs.get("value") if isinstance(volume_prefs, dict) else None

    if isinstance(planned_minutes, (int, float)):
        rem = max(0, int(planned_minutes) - ext_minutes_total)
        weekly_volume_line = f"- WEEKLY VOLUME: Target {planned_minutes} min. External events: {ext_minutes_total} min. Schedule approx {rem} min NEW training.\n"
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        tgt = int(volume_value * 60)
        rem = max(0, tgt - ext_minutes_total)
        weekly_volume_line = f"- WEEKLY VOLUME: Target {tgt} min. External events: {ext_minutes_total} min. Schedule approx {rem} min NEW training.\n"
    else:
        weekly_volume_line = "- Weekly intent: infer from recent_load, count external events.\n"

    back_to_back_rule = (
        "- AVOID BACK-TO-BACK HARD: YES (Strict).\n" if avoid_back_to_back
        else "- AVOID BACK-TO-BACK HARD: Soft preference.\n"
    )

    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = f"{strength_target_int}× per week" if strength_target_int is not None else "not specified"
    
    active_injuries = prefs.get("injuries") or []
    injury_rule = ""
    if isinstance(active_injuries, list) and len(active_injuries) > 0:
        inj_details = []
        max_severity = 0
        for inj in active_injuries:
            if isinstance(inj, dict):
                sev = _safe_int(inj.get("severity"), 0)
                if sev > max_severity: max_severity = sev
                inj_details.append(f"{inj.get('area')} ({inj.get('type')}, sev: {sev})")
        
        inj_str = ", ".join(inj_details)
        if max_severity >= 7:
            injury_rule = (
                f"- CRITICAL MEDICAL RULE (HARD): SEVERE INJURY ({inj_str}). "
                "DO NOT SCHEDULE TRAINING. All days must be REST. Title: 'Lekárske voľno'.\n\n"
            )
        else:
            injury_rule = (
                f"- ACTIVE INJURY ({inj_str}): Adjust for recovery. No high intensity. Safe mode.\n\n"
            )

    beginner_rule = ""
    explanation_rule = "- NOTES: 2-3 short sentences for every session.\n\n"
    
    if is_returning_beginner:
        beginner_rule = (
            "- BEGINNER / RETURNING ATHLETE PROTOCOL (CRITICAL):\n"
            "  The user has NO recent activity. They are unfamiliar with technical terms.\n"
            "  - You MUST explain intensity using human feeling (Talk Test).\n"
            "  - MANDATORY CUES for Run and Ride:\n"
            "    * 'Talk Test': You should be able to speak in full sentences without gasping.\n"
            "    * 'Sing Test': If you can hum or sing, the pace is perfect.\n"
            "  - FOR BIKE: Emphasize 'Cadence over Power' (keep pedaling easy).\n"
            "  - Emphasize WHY: 'Adaptation of joints and tendons takes more time than muscles.'\n"
            "  - In the output `meta` object, set `is_beginner_adaptation`: true.\n\n"
        )
        explanation_rule = "- NOTES: 3-5 detailed, encouraging sentences. Explain exactly HOW it should feel (Talk/Sing test) and WHY.\n\n"

    system_txt = (
        "You are an endurance coaching assistant. "
        "Design a daily workout schedule for ONE week based on the JSON context. "
        "Return ONE valid JSON object."
    )

    schema_text = """
    {
    "schema_version": 3,
    "meta": {
        "is_beginner_adaptation": boolean,
        "msg": "Explanation for the user if beginner mode is active"
    },
    "days": [
        {
        "date": "YYYY-MM-DD",
        "sessions": [
            {
            "sport": "run" | "ride" | "swim" | "strength" | "other",
            "title": string,
            "duration_min": number,
            "intensity": string | null,
            "session_type": string | null,
            "notes": string | null,
            "structure": {
                "warmup": { "minutes": number, "notes": string },
                
                "main_part": [ { "minutes": number, "notes": string, "target": string } ] | { "minutes": number, "notes": string },
                
                "cooldown": { "minutes": number, "notes": string },
                
                "activation": [ { "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": string } ] | null,
                "strength_main_part": [ { "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": string } ] | null,
                "add_ons": [ { "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": string } ] | null
            } | null,
            "payload"?: object | null
            }
        ]
        }
    ],
    "warnings"?: [string]
    }
    """.strip()

    date_integrity_rule = "- DATE INTEGRITY: Use only dates inside the given Week range.\n\n"
    
    external_rules = (
        "- EXTERNAL EVENTS (HARD): Include EVERY external event from context EXACTLY once on the correct date. "
        "For these events, you MUST set `session_type: \"external_event\"`.\n\n"
    )

    two_a_day_rule = f"- TWO-A-DAY: Max {two_cap} days/week. Prefer 1 session/day.\n\n"
    long_run_rule = f"- LONG RUN: If run is main sport, 1 long run (pref: {long_run_days_str}).\n\n"

    multi_sport_rule = ""
    if len(final_sports_list) > 1:
        other_sports = [s for s in final_sports_list if s != main_sport and s != "strength"]
        if other_sports:
            multi_sport_rule = (
                f"- MULTI-SPORT: Athlete sports: {', '.join(final_sports_list)}. "
                f"Schedule {', '.join(other_sports)} sessions too. Balanced plan.\n\n"
            )

    strength_rule = f"- STRENGTH: Aim for {strength_str}. Use sport='strength'.\n\n"
    
    intensity_format_rule = (
        "- INTENSITY FORMATING: In the main `intensity` field, format as 'Z1'/'Z2' or 'RPE 1/10' (e.g., if zones are missing). "
        "In the `notes` of `warmup`, `main_part`, and `cooldown`, ALWAYS include the exact Heart Rate range or Pace/Power if available, "
        "otherwise use RPE. Example: 'Upper Z2 (160-170) @ 4:30-5:00'.\n\n"
    )

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (RUN & RIDE): For every running and cycling session, "
        "provide a detailed `structure` object using `warmup`, `main_part`, and `cooldown`.\n\n"
    )

    strength_structure_rule = (
        "- STRENGTH STRUCTURE: When creating a 'strength' session, use the provided 'strength_ai_menu'. "
        "Use ONLY the specific 'exercise_id' values. Distribute the exercises into 'activation' (1-2 exercises), "
        "'strength_main_part' (3-5 heavy exercises), and 'add_ons' (1-3 core/accessory exercises).\n\n"
    )

    intensity_model_rule = f"- INTENSITY MODEL: {intensity_model}. Use Zones: {has_zones}\n\n"
    blocks_rule = f"- TRAINING BLOCKS: {', '.join([k for k,v in blocks.items() if v]) or 'none'}.\n\n"

    context_for_ai = _minify_context_for_ai(context_payload)
    safe_settings = {"language": settings.get("language"), "timezone": settings.get("timezone")}
    context_for_ai["user_settings"] = safe_settings

    user_txt = (
        "Generate a weekly plan.\n"
        f"Week: {week_index} ({week_start} .. {week_end})\n"
        f"Main Sport: {main_sport}\n"
        f"All Sports: {', '.join(final_sports_list)}\n"
        f"External events: {ext_count}\n\n"
        + date_integrity_rule
        + external_rules
        + injury_rule 
        + beginner_rule
        + two_a_day_rule
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
        + explanation_rule
        + "\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + schema_text
        + "\n\nRequirements:\n"
        + "- Single valid JSON matching schema.\n"
        + f"- Language: {lang_label}, address user as 'you' ({second_person_note}).\n"
        + "- Do NOT invent extreme workloads.\n"
    )

    return system_txt, user_txt, [], strength_target_int