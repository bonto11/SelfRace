# Services/AI/daily_plan/prompts.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# HELPERS
# ============================================================

def _safe_int(
    v: Any,
    default: int = 0,
    *,
    min_v: Optional[int] = None,
    max_v: Optional[int] = None,
) -> int:
    try:
        if v is None:
            out = default
        elif isinstance(v, (int, float)):
            out = int(v)
        elif isinstance(v, str):
            s = v.strip()
            out = int(float(s)) if s else default
        else:
            out = int(v)
    except Exception:
        out = default
    if min_v is not None and out < min_v:
        out = min_v
    if max_v is not None and out > max_v:
        out = max_v
    return out


def _as_dict(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _get_dict(d: Dict[str, Any], key: str) -> Dict[str, Any]:
    return _as_dict(d.get(key))


def _flatten_prefs(raw_prefs: Any) -> Dict[str, Any]:
    """Unwrapuje vnorený 'value' kľúč z prefs."""
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        return raw_prefs["value"]
    return raw_prefs if isinstance(raw_prefs, dict) else {}


def _remove_empty(d: Any) -> Any:
    """Rekurzívne vymaže None, [], {} — menej tokenov."""
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def _format_pace(seconds_per_km: Any) -> str:
    """Formátuje sekundy/km na mm:ss string."""
    if not isinstance(seconds_per_km, (int, float)) or seconds_per_km <= 0:
        return ""
    minutes = int(seconds_per_km) // 60
    seconds = int(seconds_per_km) % 60
    return f"{minutes}:{seconds:02d}"


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    """Vráti (jazyk_label, pravidlo_oslovovania)."""
    lang_code = str(settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Always speak directly to the athlete and use 'you'."
    if lang_code.startswith("cs"):
        return "Czech", "Vždy mluv přímo k atletovi a používej 2. osobu."
    return "Slovak", "Vždy hovor priamo k atlétovi a používej 2. osobu."


# ============================================================
# MINIFY CONTEXT
# ============================================================

def minify_daily_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva daily context pred odoslaním do AI.
    BUG FIX: external_events sa neskopíruje dvakrát — spracúva sa raz
    cez vlastnú logiku a NIE cez generický for k in (...).
    """
    context = dict(context) if isinstance(context, dict) else {}
    ctx2: Dict[str, Any] = {}

    # Priamo kopírované bloky (bez external_events — ten sa spracúva nižšie)
    for k in ("week", "zones", "thresholds", "latest_paces", "recent_load", "recovery"):
        if k in context:
            ctx2[k] = context[k]

    # Prefs — flatten + minify
    raw_prefs = context.get("prefs") or {}
    prefs = _flatten_prefs(raw_prefs)
    preferences = _get_dict(prefs, "preferences")
    volume = _get_dict(prefs, "volume")
    targets = _get_dict(prefs, "targets")

    # Targets — dynamicky pre všetky sporty (run, bike, swim, triathlon...)
    ctx_targets: Dict[str, Any] = {}
    for sport_key, sport_val in targets.items():
        if not isinstance(sport_val, dict):
            continue
        if sport_key == "strength":
            ctx_targets["strength"] = {
                "focus": sport_val.get("focus"),
                "sessions_per_week": sport_val.get("sessions_per_week"),
            }
        else:
            ctx_targets[sport_key] = {
                "race_goal": sport_val.get("race_goal"),
                "race_type": sport_val.get("race_type"),
                "target_time": sport_val.get("target_time"),
                "races": sport_val.get("races"),
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

    # Athlete state — bez metrics
    athlete_state = context.get("athlete_state")
    if isinstance(athlete_state, dict):
        ai_state = dict(_as_dict(athlete_state.get("ai_state")))
        ai_state.pop("metrics", None)
        ctx2["athlete_state"] = {
            "ai_state": ai_state,
            "user_summary": athlete_state.get("user_summary"),
            "is_returning_beginner": athlete_state.get("is_returning_beginner"),
        }

    # External events — spracúvame raz, nie dvakrát
    ext = context.get("external_events")
    if isinstance(ext, dict):
        events: List[Dict[str, Any]] = []
        if isinstance(ext.get("events"), list):
            events = [e for e in ext["events"] if isinstance(e, dict)]
        else:
            win = ext.get("window")
            if isinstance(win, dict) and isinstance(win.get("events"), list):
                events = [e for e in win["events"] if isinstance(e, dict)]

        cleaned_events: List[Dict[str, Any]] = []
        for e in events:
            dt = (
                e.get("occurrence_date")
                or e.get("date")
                or e.get("start_date_local")
                or e.get("start_date")
                or e.get("start_date_iso")
            )
            dt_ymd = str(dt)[:10] if dt else None
            dft = e.get("days_from_today")

            if dt_ymd is None and isinstance(dft, (int, float)):
                cleaned_events.append({
                    "days_from_today": int(dft),
                    "sport": e.get("sport"),
                    "duration_min": e.get("duration_min"),
                    "priority": e.get("priority"),
                    "title": e.get("title"),
                })
                continue
            if not dt_ymd:
                continue
            cleaned_events.append({
                "occurrence_date": dt_ymd,
                "sport": e.get("sport"),
                "duration_min": e.get("duration_min"),
                "priority": e.get("priority"),
                "title": e.get("title"),
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

    # Meta polia
    for k in ("week_meta", "replan_trigger", "generate_reason", "is_replan", "planning_constraints"):
        if k in context:
            ctx2[k] = context[k]

    return _remove_empty(ctx2)


# ============================================================
# INTENSITY & PACE
# ============================================================

def _build_intensity_format_rule(
    has_zones: bool,
    latest_paces: Dict[str, Any],
) -> str:
    """
    Zostaví inštrukciu pre formát intenzity — buď zones+pace alebo RPE+pace.
    Extrahovaná ako samostatná funkcia pre čitateľnosť.
    """
    if not has_zones:
        return (
            "- INTENSITY FORMATTING (NO ZONES): "
            "In `notes` fields for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH RPE AND Pace (min/km) or Power (W). "
            "Example Format: 'RPE 3/10 @ 6:00-6:30 min/km'. "
            "Keep paces conservative for easy runs, warmups, and cooldowns.\n\n"
        )

    # Zones sú — pridáme pace referenciu ak existuje
    pace_parts = []
    for i in range(1, 6):
        val = latest_paces.get(f"z{i}_pace_s")
        if val is not None:
            pace_parts.append(f"Z{i}: {_format_pace(val)}")

    if pace_parts:
        pace_instructions = (
            f"CRITICAL: When prescribing Pace for running, use these references: "
            f"{', '.join(pace_parts)}. Do not deviate by more than 5-10 sec/km unless hilly or trail-based.\n"
        )
    else:
        pace_instructions = (
            "CRITICAL: No pace history found. ESTIMATE realistic paces from recent load and athlete state. "
            "Keep it conservative.\n"
        )

    return (
        "- INTENSITY FORMATTING (HAS ZONES): "
        "In `notes` for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH Target HR range (bpm) AND Pace (min/km) or Power (W). "
        "CRITICAL HR RULE: DO NOT output the full zone width (e.g. '0-154 bpm'). "
        "Prescribe a narrower 10-15 bpm target window strictly WITHIN the zone bounds (e.g. '135-150 bpm'). "
        "Example: 'Z2 (145-155 bpm) @ 6:15 min/km'. "
        f"{pace_instructions}\n"
    )


def _check_has_zones(zones_data: Dict[str, Any]) -> bool:
    """Kontroluje či má user nastavené HR zóny."""
    for key, val in zones_data.items():
        if isinstance(val, dict):
            if val.get("z1_min") is not None or val.get("z1_max") is not None:
                return True
            if isinstance(val.get("zones"), list) and len(val["zones"]) > 0:
                return True
        elif key in ("z1_min", "z1_max") and val is not None:
            return True
    return False


# ============================================================
# SPECIAL REASON RULES
# ============================================================

def _build_special_reason_rule(reason: Optional[str]) -> str:
    """Vráti špeciálnu inštrukciu pre AI podľa dôvodu generovania."""
    if reason == "health_mild_restriction":
        return (
            "\n--- CRITICAL HEALTH RESTRICTION (MILD INJURY / ILLNESS) ---\n"
            "- Athlete reported a mild health issue or is recovering.\n"
            "- SIGNIFICANTLY REDUCE INTENSITY AND VOLUME.\n"
            "- NO VO2Max, Threshold, or heavy Sprint intervals.\n"
            "- ALL sessions MUST be easy (Z1/Z2 or RPE 2-4/10) or active recovery.\n"
            "- Cap ALL session durations to max 40-50 minutes. NO long runs.\n"
        )
    if reason == "manual_review":
        return (
            "\n--- ATHLETE REQUESTED ADJUSTMENT ---\n"
            "- Athlete requested manual plan evaluation via Activity Review.\n"
            "- Check latest Activity Review in 'athlete_state' and adjust upcoming sessions accordingly.\n"
        )
    if reason == "soften":
        return (
            "\n--- FATIGUE / SOFTEN REQUEST ---\n"
            "- Athlete's recent load is too high.\n"
            "- Replace hard intervals with easy endurance or active recovery.\n"
        )
    if reason in ("health_resolved", "health_resolved_return", "return_to_training"):
        return (
            "\n--- ⚠️ RETURN TO TRAINING (RECOVERED) ⚠️ ---\n"
            "- Athlete JUST RECOVERED from significant illness or injury.\n"
            "- CRITICAL: NO high intensity. ONLY Z1/Z2 for the ENTIRE week.\n"
            "- EXTRA REST DAYS (3 rest days instead of 1).\n"
            "- Reduce Strength goals if needed to keep load very light.\n"
            "- External events: include them but add strong warning to train at Z1/Z2 only.\n"
        )
    if reason == "refill_auto_extend":
        return (
            "\n--- ⚠️ PARTIAL WEEK REFILL (CRITICAL) ⚠️ ---\n"
            "- Week is ALREADY PARTIALLY COMPLETED.\n"
            "- Check 'recent_load' to see what was done THIS week.\n"
            "- Generate ONLY workouts for REMAINING days to reach weekly 'planned_minutes'.\n"
            "- Do NOT repeat session types already done this week.\n"
        )
    return ""


# ============================================================
# SCHEMA
# ============================================================

def _daily_schema(lang_label: str) -> str:
    """JSON schéma pre daily plán."""
    return f"""
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
          "title": "Descriptive title in {lang_label}",
          "duration_min": number,
          "distance_km": number,
          "tss_estimate": number,
          "notes": "REQUIRED. 1-2 short sentences in {lang_label} describing session purpose.",
          "session_type": "external_event" | null,
          "structure": {{
            "warmup": {{ "minutes": number, "notes": "Target HR (bpm) AND Pace/Power. max 2 sentences." }},
            "main_part": [ object ],
            "cooldown": {{ "minutes": number, "notes": "Target HR (bpm) AND Pace/Power. max 2 sentences." }},
            "activation": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ],
            "strength_main_part": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ],
            "add_ons": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ]
          }}
        }}
      ]
    }}
  ]
}}
""".strip()


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre daily týždenný plán.
    Návratová hodnota je Tuple[str, str] — strength_target a prázdny list
    sa odstraňujú (generate.py ich nepoužíval).
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    week = _get_dict(context_payload, "week")
    prefs = _flatten_prefs(context_payload.get("prefs") or {})
    constraints = _get_dict(context_payload, "planning_constraints")
    is_returning_beginner = bool(constraints.get("is_returning_beginner"))

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"

    # Zoznam všetkých sportov
    sports_set = {main_sport}
    for key in ("add_on_sports", "included_sports"):
        lst = prefs.get(key)
        if isinstance(lst, list):
            sports_set.update(s.lower() for s in lst if isinstance(s, str) and s)
    final_sports_list = list(sports_set)

    pref_obj = _get_dict(prefs, "preferences")
    days_off = [
        str(d) for d in (pref_obj.get("days_off") or [])
        if isinstance(d, str) and d.strip()
    ]
    two = _get_dict(pref_obj, "two_a_day")
    two_enabled = bool(two.get("enabled"))
    two_cap = _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2) if two_enabled else 0
    long_run_days = [
        str(d) for d in (pref_obj.get("long_run_days") or [])
        if isinstance(d, str) and d.strip()
    ]
    avoid_back_to_back = bool(pref_obj.get("avoid_back_to_back_hard"))
    intensity_model = (
        "pyramidal"
        if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal"
        else "polarized"
    )

    # Zones check
    zones_data = _as_dict(context_payload.get("zones"))
    has_zones = _check_has_zones(zones_data)

    # Training blocks
    tb = _get_dict(pref_obj, "training_blocks")
    blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    # Strength
    strength_settings = _get_dict(prefs, "strength_settings")
    strength_target_int: Optional[int] = None
    ss_raw = strength_settings.get("sessions_per_week")
    if isinstance(ss_raw, (int, float, str)):
        try:
            strength_target_int = int(ss_raw)
        except Exception:
            pass

    # External events
    ext = _as_dict(context_payload.get("external_events"))
    ext_occ = ext.get("occurrences")
    if not isinstance(ext_occ, list):
        ext_occ = []
    ext_count = len(ext_occ)
    ext_minutes_total = sum(
        _safe_int(e.get("duration_min"), 0)
        for e in ext_occ
        if isinstance(e, dict)
    )

    # Volume
    volume_prefs = _get_dict(prefs, "volume")
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- WEEKLY VOLUME: Plan target is {planned_minutes} min. "
            f"External events: {ext_minutes_total} min. "
            "CRITICAL: NEVER exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        tgt = int(volume_value * 60)
        weekly_volume_line = (
            f"- WEEKLY VOLUME: Long-term goal is {tgt} min/week. "
            f"External events: {ext_minutes_total} min. "
            "CRITICAL: NEVER exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`.\n"
        )
    else:
        weekly_volume_line = (
            "- WEEKLY VOLUME: Infer from recent_load and DO NOT exceed "
            "`athlete_state.ai_state.volume_tolerance.weekly_minutes_max`.\n"
        )

    # Rules
    if days_off:
        rest_days_rule = (
            f"- REST DAYS (CRITICAL): Explicit days off: {', '.join(days_off)}. "
            "Schedule ONLY complete rest on these days (sport='other', kind='rest', duration_min=0). No exceptions.\n\n"
        )
    else:
        rest_days_rule = (
            "- REST DAYS & SPACING (CRITICAL): No explicit days off selected. "
            "MUST keep AT LEAST 1 DAY completely free. "
            "On rest day: one session with sport='other', kind='rest', duration_min=0. "
            "DO NOT schedule more than 3 consecutive training days without a rest day.\n\n"
        )

    if two_enabled and two_cap > 0:
        two_a_day_rule = (
            f"- TWO-A-DAY: Max {two_cap} days/week can have 2 sessions. "
            "Use to group sessions (e.g. Run + Strength) to free up rest days.\n\n"
        )
    else:
        two_a_day_rule = (
            "- TWO-A-DAY (CRITICAL): Max 0 days/week can have 2 sessions. "
            "FORBIDDEN from scheduling 2 sessions on same day. "
            "If too many workouts — DROP some sessions. NEVER train 7 days a week.\n\n"
        )

    strength_str = f"{strength_target_int}× per week" if strength_target_int else "not specified"
    strength_rule = (
        f"- STRENGTH: Target {strength_str}. Use sport='strength'. "
        "If two_a_day is disabled and lack days — REDUCE strength sessions. DO NOT sacrifice rest days.\n\n"
    )
    long_run_rule = (
        f"- LONG RUN: If run is main sport, 1 long run "
        f"(pref: {', '.join(long_run_days) if long_run_days else 'none'}).\n\n"
    )
    back_to_back_rule = (
        "- AVOID BACK-TO-BACK HARD: YES (Strict).\n"
        if avoid_back_to_back
        else "- AVOID BACK-TO-BACK HARD: Soft preference.\n"
    )

    multi_sport_rule = ""
    other_sports = [s for s in final_sports_list if s != main_sport and s != "strength"]
    if other_sports:
        multi_sport_rule = (
            f"- MULTI-SPORT: Sports: {', '.join(final_sports_list)}. "
            f"Schedule {', '.join(other_sports)} sessions too.\n\n"
        )

    beginner_rule = (
        "- BEGINNER / RETURNING ATHLETE PROTOCOL (CRITICAL):\n"
        "  - Explain intensity using human feeling (Talk Test, Sing Test).\n"
        "  - Emphasize: 'Walking during a run is success, not failure.'\n"
        "  - FOR BIKE: 'Cadence over Power'.\n\n"
        if is_returning_beginner
        else ""
    )

    latest_paces = _as_dict(context_payload.get("latest_paces"))
    intensity_format_rule = _build_intensity_format_rule(has_zones, latest_paces)

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (RUN & RIDE): Provide `structure` with `warmup`, `main_part`, `cooldown`.\n"
        "  - Steady run: `main_part` = array of objects with `minutes` and `notes`.\n"
        "  - Interval session: use `interval_block` format in `main_part`.\n\n"
    )
    strength_structure_rule = (
        "- STRENGTH STRUCTURE: Use 'strength_ai_menu' exercise_ids. "
        "Distribute into 'activation' (1-2), 'strength_main_part' (3-5), 'add_ons' (1-3).\n"
        "  - Title MUST reflect focus (e.g. 'Silový tréning - Nohy a Core').\n\n"
    )

    special_reason_rule = _build_special_reason_rule(
        context_payload.get("generate_reason")
    )
    sports_restriction = (
        f"- ALLOWED SPORTS: {', '.join(final_sports_list)}. "
        "ONLY populate sessions for listed sports.\n\n"
    )

    context_for_ai = minify_daily_context_for_ai(context_payload)

    system_txt = (
        "You are an elite endurance coaching assistant. "
        "Your task is to design a detailed DAILY training plan for the current week. "
        "Return ONE valid JSON object only. Do NOT output prose or markdown."
    )

    user_txt = (
        f"Generate a weekly plan.\n"
        f"Week: {week_index} ({week_start} .. {week_end})\n"
        f"Main Sport: {main_sport}\n"
        f"All Sports: {', '.join(final_sports_list)}\n"
        f"External events: {ext_count}\n\n"
        "- DATE INTEGRITY: Use ONLY dates inside the given Week range.\n\n"
        "- EXTERNAL EVENTS (CRITICAL - OVERRIDE EVERYTHING): Check `external_events`. "
        "If events exist, MUST schedule them on exact dates with sport='other', kind='other', session_type='external_event'. NEVER ignore.\n\n"
        "- RACE SCHEDULING (CRITICAL):\n"
        "  1. Check `external_events` AND `prefs.targets.*.races`. If race has exact date in THIS week, schedule it.\n"
        "  2. If NO exact-date race this week — STRICTLY FORBIDDEN to invent race days.\n"
        "  3. Exception: Virtual Race ONLY at end of final week of entire macrocycle.\n\n"
        + rest_days_rule
        + two_a_day_rule
        + beginner_rule
        + long_run_rule
        + multi_sport_rule
        + strength_rule
        + sports_restriction
        + intensity_format_rule
        + endurance_structure_rule
        + strength_structure_rule
        + f"- INTENSITY MODEL: {intensity_model}. Use Zones: {has_zones}\n\n"
        + f"- TRAINING BLOCKS: {', '.join(k for k, v in blocks.items() if v) or 'none'}.\n\n"
        + weekly_volume_line
        + back_to_back_rule
        + special_reason_rule
        + "\n--- STRICT CONCISENESS ---\n"
        "- OMIT optional fields (distance_km, tss_estimate) if null.\n"
        "- 'title' and 'notes' are REQUIRED for every session.\n"
        "- Strength exercise notes: max 5 words.\n"
        "- DO NOT exceed 8000 tokens in output.\n"
        "\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _daily_schema(lang_label)
        + "\n\nRequirements:\n"
        "- Single valid JSON matching schema.\n"
        f"- Language: {lang_label}. {second_person_note}\n"
        "- Do NOT invent extreme workloads. Check recent_load to avoid huge volume spikes.\n"
        "- Return ONLY valid JSON. No markdown, no explanations before or after.\n"
    )

    return system_txt, user_txt