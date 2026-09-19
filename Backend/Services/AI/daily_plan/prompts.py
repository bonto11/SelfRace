# Services/AI/daily_plan/prompts.py
from __future__ import annotations

import json
from datetime import date
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


def _days_until(date_str: Optional[str]) -> Optional[int]:
    """Počet dní do dátumu od dnes."""
    if not date_str:
        return None
    try:
        return (date.fromisoformat(str(date_str)[:10]) - date.today()).days
    except Exception:
        return None


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    """Vráti (jazyk_label, pravidlo_oslovovania)."""
    lang_code = str(settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Always speak directly to the athlete and use 'you'."
    if lang_code.startswith("cs"):
        return "Czech", "Vždy mluv přímo k atletovi a používej 2. osobu."
    return "Slovak", "Vždy hovor priamo k atlétovi a používej 2. osobu."


def _time_format_rule() -> str:
    """
    Spoločné pravidlo pre formátovanie akéhokoľvek trvania vo voľnom texte
    (notes, titles). Zabraňuje AI písať surové sekundy namiesto čitateľného formátu.
    """
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration in `notes` or `title` "
        "(e.g. interval work/rest length). Always format as human-readable time: "
        "use 'M:SS' when under an hour (e.g. 90 seconds -> '1:30', 45 seconds -> '0:45'), "
        "and 'H:MM:SS' when an hour or more. Pace is always 'mm:ss/km'.\n"
    )

def _terminology_rule(lang_label: str) -> str:
    """
    Zabraňuje AI substitúcii sémanticky/foneticky podobných, ale nesprávnych
    slov v generovanom texte (notes, title) — bežná chyba LLM pri generovaní
    v slovenčine/češtine, keď si model "prehodí" podobne znejúce slovo.
    """
    return (
        "- WORD ACCURACY (CRITICAL): Use ONLY standard, correct sport/anatomy terminology "
        "in `title` and `notes`. Before finalizing any text, double-check every word is the "
        "one you actually meant — LLMs sometimes substitute a phonetically or visually similar "
        "but WRONG word (a known failure mode), especially in Slovak/Czech.\n"
        "  Examples of this exact mistake to AVOID:\n"
        "  - Slovak: 'nohy' (legs) MUST NOT become 'nohavice' (trousers/pants).\n"
        "  - Do not invent or drift into clothing, furniture, or unrelated nouns when describing "
        "body parts, muscle groups, or exercise focus areas.\n"
        f"  Re-read each generated {lang_label} sentence once and confirm every noun matches "
        "its intended meaning before including it in the output.\n"
    )

# ============================================================
# MINIFY CONTEXT
# ============================================================

def minify_daily_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva daily context pred odoslaním do AI.

    Optimalizácie v tejto verzii:
    - latest_paces: odstráni id, user_id, measured_at (DB metadata)
    - external_events: posiela len ak má reálne eventy (nie prázdny window)
    - recent_load: max 4 týždne namiesto 6-7
    - athlete_state: odstráni user_summary (dlhé texty nepotrebné pre daily)
      a plan_adjustment (nie je relevantný pre daily plánovač)
    - races: odstráni UUID id, pridá days_until_race
    - zones: posiela len run zóny (nie všetky sporty)
    """
    context = dict(context) if isinstance(context, dict) else {}
    ctx2: Dict[str, Any] = {}

    # Week — priamo
    if "week" in context:
        ctx2["week"] = context["week"]

    # Zones — len run zóny (nie celý dict ak je tam ride/swim/atď)
    zones_raw = context.get("zones")
    if isinstance(zones_raw, dict):
        ctx2["zones"] = zones_raw  # zachovaj celé, AI potrebuje zóny pre sport

    # Thresholds — priamo
    if "thresholds" in context:
        ctx2["thresholds"] = context["thresholds"]

    # latest_paces — odstráni DB metadata (id, user_id, measured_at)
    paces = context.get("latest_paces")
    if isinstance(paces, dict):
        ctx2["latest_paces"] = {
            k: v for k, v in paces.items()
            if k not in ("id", "user_id", "measured_at")
        }

    # recent_load — max 4 týždne (nie 6-7), šetrí ~200 tokenov
    recent_load = context.get("recent_load")
    if isinstance(recent_load, dict):
        weeks = recent_load.get("weeks") or []
        trimmed_weeks = [
            w for w in weeks
            if isinstance(w, dict) and int(w.get("week_index_from_now", -99)) >= -4
        ]
        ctx2["recent_load"] = {**recent_load, "weeks": trimmed_weeks}

    # Recovery — priamo ak existuje
    if "recovery" in context:
        ctx2["recovery"] = context["recovery"]

    # Prefs — flatten + minify
    raw_prefs = context.get("prefs") or {}
    prefs = _flatten_prefs(raw_prefs)
    preferences = _get_dict(prefs, "preferences")
    volume = _get_dict(prefs, "volume")
    targets = _get_dict(prefs, "targets")

    # Targets — dynamicky, races bez UUID, s days_until_race
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
            races_raw = sport_val.get("races")
            races_clean = None
            if isinstance(races_raw, list):
                races_clean = []
                for r in races_raw:
                    if not isinstance(r, dict):
                        continue
                    race_date = r.get("date") or r.get("start_date")
                    races_clean.append({
                        "name": r.get("name"),
                        "date": race_date,
                        "days_until_race": _days_until(race_date),
                        "race_goal": r.get("race_goal"),
                        "race_type": r.get("race_type"),
                        "target_time": r.get("target_time"),
                        "custom_distance_km": r.get("custom_distance_km"),
                        "elevation_gain_m": r.get("elevation_gain_m"),
                        "terrain": r.get("terrain"),
                        "priority": r.get("priority"),
                    })
            ctx_targets[sport_key] = {
                "race_goal": sport_val.get("race_goal"),
                "race_type": sport_val.get("race_type"),
                "target_time": sport_val.get("target_time"),
                "races": races_clean,
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

    # Athlete state — bez user_summary (dlhé texty) a bez plan_adjustment
    # Daily planner potrebuje len ai_state pre kapacity, únavu, zóny tolerancie
    athlete_state = context.get("athlete_state")
    if isinstance(athlete_state, dict):
        ai_state = dict(_as_dict(athlete_state.get("ai_state")))
        ai_state.pop("metrics", None)           # nie je potrebné pre daily
        ai_state.pop("plan_adjustment", None)   # nie je relevantné pre daily builder
        ctx2["athlete_state"] = {
            "ai_state": ai_state,
            # user_summary — vynechané, šetrí ~300 tokenov, daily ho nepotrebuje
            "is_returning_beginner": athlete_state.get("is_returning_beginner"),
        }

    # External events — len ak má reálne eventy (nie prázdny window)
    ext = context.get("external_events")
    if isinstance(ext, dict):
        events: List[Dict[str, Any]] = []
        if isinstance(ext.get("events"), list):
            events = [e for e in ext["events"] if isinstance(e, dict)]
        else:
            win = ext.get("window")
            if isinstance(win, dict) and isinstance(win.get("events"), list):
                events = [e for e in win["events"] if isinstance(e, dict)]

        if events:  # len ak má reálne eventy
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
        # Ak events je prázdny — external_events sa nevloží do ctx2

    # Meta polia
    for k in ("week_meta", "replan_trigger", "generate_reason", "is_replan", "planning_constraints"):
        if k in context:
            ctx2[k] = context[k]

    # Coach notes — sticky + ephemeral (bez ephemeral_note_id ktorý je len pre main.py)
    coach_notes = context.get("coach_notes")
    if isinstance(coach_notes, dict):
        sticky = coach_notes.get("sticky_notes") or []
        ephemeral = coach_notes.get("ephemeral_note")
        if sticky or ephemeral:
            ctx2["coach_notes"] = {
                "sticky_notes": sticky,
                **({"ephemeral_note": ephemeral} if ephemeral else {}),
            }

    return _remove_empty(ctx2)


# ============================================================
# INTENSITY & PACE
# ============================================================

def _build_intensity_format_rule(
    has_zones: bool,
    latest_paces: Dict[str, Any],
    lthr: Optional[float] = None,
) -> str:
    """Zostaví inštrukciu pre formát intenzity + LTHR pravidlo pre threshold sessions."""
    lthr_rule = (
        f"- THRESHOLD RULE: LTHR = {int(lthr)} bpm = Z4/Z5 boundary. "
        "Threshold/Prahový sessions target Z4. NEVER prescribe Z3 for threshold sessions.\n"
        if lthr else ""
    )

    if not has_zones:
        return (
            lthr_rule +
            "- INTENSITY FORMATTING (NO ZONES): "
            "In `notes` fields for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH RPE AND Pace (min/km) or Power (W). "
            "Example Format: 'RPE 3/10 @ 6:00-6:30 min/km'. "
            "Keep paces conservative for easy runs, warmups, and cooldowns.\n\n"
        )

    pace_parts = []
    for i in range(1, 6):
        val = latest_paces.get(f"z{i}_pace_s")
        if val is not None:
            pace_parts.append(f"Z{i}: {_format_pace(val)}")

    pace_instructions = (
        f"CRITICAL: When prescribing Pace for running, use these references: "
        f"{', '.join(pace_parts)}. Do not deviate by more than 5-10 sec/km unless hilly or trail-based.\n"
        if pace_parts else
        "CRITICAL: No pace history found. ESTIMATE realistic paces from recent load and athlete state. Keep it conservative.\n"
    )

    return (
        lthr_rule +
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
            "main_part": [
              {{
                "minutes": number,
                "notes": "Target HR (bpm) AND Pace/Power. max 2 sentences."
              }}
              // OR for interval sessions, use this EXACT shape instead (see INTERVAL BLOCK FORMAT rule):
              // {{
              //   "kind": "interval_block",
              //   "rounds": number,
              //   "work": {{ "minutes": number, "notes": "..." }},
              //   "rest":  {{ "minutes": number, "notes": "..." }}
              // }}
            ],
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

def _build_strength_structure_rule(
    equipment_mode: Optional[str],
    target_duration_min: int,
) -> str:
    """
    🌟 FIX (v2): predtým táto inštrukcia nehovorila nič o tom, ako rozdeliť
    záťažové vs bodyweight cviky (opravené skôr), ale ANI nič o CIEĽOVEJ
    DĹŽKE session - AI si teda sama zvolila počet sérií/pauz bez väzby na
    reálny čas, čo systematicky vychádzalo na 35-40 min namiesto
    očakávanej hodiny. Teraz musí AI explicitne spočítať odhadovaný čas
    štruktúry a prispôsobiť POČET cvikov/sérií cieľovej dĺžke, nie naopak.
    """
    if equipment_mode in ("full_gym", "minimal"):
        load_note = (
            "  - CRITICAL: 'strength_main_part' MUST consist primarily of exercises with "
            "'loaded': true from 'strength_ai_menu' (compound barbell/dumbbell/kettlebell/machine "
            "lifts). Do NOT fill 'strength_main_part' mostly with 'loaded': false (bodyweight-only) "
            "exercises when the athlete has gym/load equipment available - that is a planning error.\n"
        )
    else:
        load_note = (
            "  - Equipment is limited/none - bodyweight and minimal-equipment exercises are the "
            "correct choice throughout, not a fallback.\n"
        )
    return (
        "- STRENGTH STRUCTURE: Use 'strength_ai_menu' exercise_ids only (from 'available_catalog').\n"
        "  - Distribute into 'activation' (1-2 - light bodyweight/mobility, prepares the body), "
        "'strength_main_part' (3-5 - the actual training stimulus), 'add_ons' (1-3 - accessory/core/calves).\n"
        + load_note +
        "  - Title MUST reflect focus (e.g. 'Silový tréning - Nohy a Core').\n\n"
        "- STRENGTH SESSION DURATION (CRITICAL): The athlete's target duration for a strength "
        f"session is {target_duration_min} minutes, and this MUST be the actual, real time the "
        "prescribed structure takes - not just the number written in `duration_min`.\n"
        "  - Estimate real time as: sum of every set's work time + every set's rest_s (converted "
        "to minutes) across activation, strength_main_part, and add_ons, plus a short implicit "
        "transition/setup time between exercises (roughly 1 minute per exercise).\n"
        f"  - If this estimate comes out well under {target_duration_min} minutes, you MUST add "
        "more sets, more exercises (still within the 1-2 / 3-5 / 1-3 counts above, e.g. use the "
        "upper end of each range), and/or realistic compound-lift rest periods (90-180s for heavy "
        f"compound lifts) until the real time reasonably matches {target_duration_min} minutes - "
        "do NOT simply write a bigger `duration_min` number without a structure that actually "
        "takes that long.\n"
        f"  - If the estimate comes out well over {target_duration_min} minutes, trim exercises or "
        "sets rather than cutting rest periods below safe/effective ranges (60s minimum for "
        "accessory work, 90s minimum for heavy compound lifts).\n"
        "  - Set the session's `duration_min` field to this estimated real time (it should closely "
        f"match {target_duration_min}, not be an arbitrary round number).\n\n"
    )



def _build_strength_focus_rule(is_strength_primary_focus: bool) -> str:
    """
    🌟 NOVÉ: samostatné pravidlo pre athlete, ktorého hlavným (alebo
    jediným) športom je strength - napr. main_sport == 'strength', alebo
    included_sports neobsahuje žiadny endurance šport. Predtým sa strength
    vždy generoval len ako "doplnok" k behu/bike/swim bez ohľadu na to,
    či to bol jediný šport athlete - chýbala periodizácia a progresia.
    """
    if not is_strength_primary_focus:
        return ""
    return (
        "\n--- STRENGTH IS THE ATHLETE'S PRIMARY FOCUS ---\n"
        "- The athlete's plan is NOT built around an endurance sport this week - strength "
        "training itself is the primary goal, not an accessory to running/cycling/swimming.\n"
        "- Apply real progressive-overload thinking: vary rep ranges across sessions this week "
        "(e.g. one session lower-rep/heavier 4-6 reps, another moderate 8-12 reps) rather than "
        "repeating the same sets/reps every session.\n"
        "- Prioritize compound 'loaded': true lifts (squat, deadlift, press, row family) as the "
        "core of every 'strength_main_part' - this is a real strength-training week, not injury "
        "prevention or activation work.\n"
        "- It is appropriate to schedule more strength sessions per week than the usual endurance-"
        "supplement default, as long as REST DAYS and TWO-A-DAY rules above are still respected.\n"
    )

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
    Vracia Tuple[str, str].
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

    # Zoznam sportov — pridaj strength ak má sessions_per_week > 0
    sports_set = {main_sport}
    for key in ("add_on_sports", "included_sports"):
        lst = prefs.get(key)
        if isinstance(lst, list):
            sports_set.update(s.lower() for s in lst if isinstance(s, str) and s)

    # Strength — pridaj do allowed sports ak je nastavené
    strength_settings = _get_dict(prefs, "strength_settings")
    strength_target_int: Optional[int] = None
    try:
        ss_raw = strength_settings.get("sessions_per_week") or constraints.get("strength_sessions_per_week_target")
        if ss_raw:
            strength_target_int = int(ss_raw)
            if strength_target_int > 0:
                sports_set.add("strength")
    except Exception:
        pass

    final_sports_list = list(sports_set)

    pref_obj = _get_dict(prefs, "preferences")
    days_off = [
        str(d) for d in (pref_obj.get("days_off") or [])
        if isinstance(d, str) and d.strip()
    ]
    two = _get_dict(pref_obj, "two_a_day")
    two_enabled = bool(two.get("enabled"))
    two_cap = _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2) if two_enabled else 0

    # Two-a-day z constraints (builder ho nastavuje správne)
    if not two_enabled:
        two_cap_constraint = _safe_int(constraints.get("two_a_day_max_days_per_week"), 0)
        if two_cap_constraint > 0:
            two_enabled = True
            two_cap = two_cap_constraint

    long_run_days = [
        str(d) for d in (pref_obj.get("long_run_days") or constraints.get("long_run_days") or [])
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

    # LTHR pre threshold pravidlo
    thresholds = _as_dict(context_payload.get("thresholds"))
    run_thresh = _as_dict(thresholds.get("run"))
    lthr = run_thresh.get("lthr_bpm")

    # Training blocks
    tb = _get_dict(pref_obj, "training_blocks")
    blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    # External events count
    ext = _as_dict(context_payload.get("external_events"))
    ext_occ = ext.get("occurrences") or []
    if not isinstance(ext_occ, list):
        ext_occ = []
    ext_count = len(ext_occ)
    ext_minutes_total = sum(
        _safe_int(e.get("duration_min"), 0) for e in ext_occ if isinstance(e, dict)
    )

    # Volume
    volume_prefs = _get_dict(prefs, "volume")
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- WEEKLY VOLUME: Plan target is {planned_minutes} min. "
            f"External events: {ext_minutes_total} min. "
            "CRITICAL: NEVER exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. "
            "If ATHLETE INSTRUCTIONS above exclude a sport, this volume target no longer applies "
            "to that sport's minutes — do not try to 'make up' the excluded sport's volume with it.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        tgt = int(volume_value * 60)
        weekly_volume_line = (
            f"- WEEKLY VOLUME: Long-term goal is {tgt} min/week. "
            f"External events: {ext_minutes_total} min. "
            "CRITICAL: NEVER exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. "
            "If ATHLETE INSTRUCTIONS above exclude a sport, this volume target no longer applies "
            "to that sport's minutes.\n"
        )
    else:
        weekly_volume_line = (
            "- WEEKLY VOLUME: Infer from recent_load. "
            "DO NOT exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. "
            "If ATHLETE INSTRUCTIONS above exclude a sport, do not compensate its volume with another sport.\n"
        )

    # Rules
    if days_off:
        rest_days_rule = (
            f"- REST DAYS (CRITICAL): Explicit days off: {', '.join(days_off)}. "
            "Schedule ONLY complete rest (sport='other', kind='rest', duration_min=0). No exceptions.\n\n"
        )
    else:
        rest_days_rule = (
            "- REST DAYS & SPACING (CRITICAL): No explicit days off. "
            "MUST keep AT LEAST 1 DAY completely free. "
            "On rest day: one session with sport='other', kind='rest', duration_min=0. "
            "DO NOT schedule more than 3 consecutive training days without a rest day.\n\n"
        )

    if two_enabled and two_cap > 0:
        two_a_day_rule = (
            f"- TWO-A-DAY: Max {two_cap} days/week can have 2 sessions. "
            "Use to group (e.g. Run + Strength) to free up rest days.\n\n"
        )
    else:
        two_a_day_rule = (
            "- TWO-A-DAY (CRITICAL): Max 0 days/week can have 2 sessions. "
            "FORBIDDEN from scheduling 2 sessions on same day. "
            "If too many workouts — DROP some. NEVER train 7 days a week.\n\n"
        )

    strength_str = f"{strength_target_int}× per week" if strength_target_int else "not specified"
    strength_rule = (
        f"- STRENGTH: Target {strength_str}. Use sport='strength'. "
        "If two_a_day disabled and lack days — REDUCE strength sessions. DO NOT sacrifice rest days.\n\n"
    )

    # 🌟 FIX (ROOT CAUSE #2): táto vetva bola PREDTÝM nepodmienečná — vždy
    # naplánovala 1 long run, ak bol run main_sport, úplne bez ohľadu na to,
    # či athlete instructions run vylúčili. Presne toto vynucovalo "1x long
    # run" v dennom pláne aj napriek jasnej poznámke "žiadny beh". Teraz je
    # explicitne podmienená a odkazuje na ATHLETE INSTRUCTIONS.
    long_run_rule = (
        f"- LONG RUN: Unless ATHLETE INSTRUCTIONS above exclude or restrict running, and if run is "
        f"the main sport, include 1 long run "
        f"(pref: {', '.join(long_run_days) if long_run_days else 'none'}). "
        "If running is excluded by ATHLETE INSTRUCTIONS, skip this rule entirely — do NOT schedule "
        "any long run, or any run, this week.\n\n"
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
            f"Schedule {', '.join(other_sports)} sessions too — UNLESS ATHLETE INSTRUCTIONS above "
            "exclude one of these sports, in which case skip it entirely.\n\n"
        )

    beginner_rule = (
        "- BEGINNER / RETURNING ATHLETE PROTOCOL (CRITICAL):\n"
        "  - Explain intensity using human feeling (Talk Test, Sing Test).\n"
        "  - Emphasize: 'Walking during a run is success, not failure.'\n"
        "  - FOR BIKE: 'Cadence over Power'.\n\n"
        if is_returning_beginner else ""
    )

    latest_paces = _as_dict(context_payload.get("latest_paces"))
    intensity_format_rule = _build_intensity_format_rule(has_zones, latest_paces, lthr)

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (RUN & RIDE): Provide `structure` with `warmup`, `main_part`, `cooldown`.\n"
        "  - `main_part` is ALWAYS an array. Each element is EITHER a steady block OR an interval block "
        "(you may mix both in the same array for progressive sessions, e.g. steady → interval → steady).\n\n"
        "- STEADY BLOCK FORMAT (single continuous effort): "
        '{ "minutes": number, "notes": "..." }. Use this for warmup-style ramps, tempo holds, '
        "or any single-effort segment that does not repeat.\n\n"
        "- INTERVAL BLOCK FORMAT (repeated work/rest, e.g. VO2max, threshold repeats, fartlek): "
        "You MUST use EXACTLY this shape, with these EXACT field names — do not rename, nest, or "
        "restructure them:\n"
        '{ "kind": "interval_block", "rounds": number, '
        '"work": { "minutes": number, "notes": "..." }, '
        '"rest": { "minutes": number, "notes": "..." } }\n'
        "  - `rounds` = how many times work+rest repeats (e.g. 6 for '6x3min hard, 2min easy').\n"
        "  - `work` = the hard/target-intensity portion. `rest` = the recovery portion between reps.\n"
        "  - If the session has NO recovery between reps (e.g. straight repeats with no rest), "
        "omit `rest` entirely rather than inventing a zero-duration one.\n"
        "  - NEVER use alternate field names like `repeats`, `intervals`, `work_min`, or nested variants — "
        "the app parses ONLY `rounds`, `work`, and `rest` exactly as specified above.\n\n"
    )
    strength_ai_menu = _as_dict(constraints.get("strength_ai_menu"))
    equipment_mode_for_prompt = strength_ai_menu.get("equipment_mode")
    # 🌟 NOVÉ: cieľová dĺžka session z constraints (builder ju vždy vyplní,
    # aj defaultom, takže tu je vždy platné číslo).
    strength_duration_target = _safe_int(
        constraints.get("strength_session_duration_min_target"), 60, min_v=15, max_v=180
    )
    strength_structure_rule = _build_strength_structure_rule(
        equipment_mode_for_prompt, strength_duration_target
    )

    is_strength_primary_focus = (
        "strength" in final_sports_list
        and not any(s in final_sports_list for s in ("run", "ride", "swim"))
    )
    strength_focus_rule = _build_strength_focus_rule(is_strength_primary_focus)

    special_reason_rule = _build_special_reason_rule(context_payload.get("generate_reason"))

    # 🌟 ATHLETE INSTRUCTIONS (sticky + ephemeral notes) — najvyššia priorita,
    # explicitne nadraďuje default main_sport/ALLOWED SPORTS/LONG RUN pravidlá.
    #
    # FIX HISTÓRIA:
    # 1) Táto sekcia sa predtým vypočítala, ale nikdy sa nepridala do
    #    finálneho promptu (chýbajúce "+ notes_rule" pri skladaní user_txt).
    # 2) Po oprave #1 stále prehrávala proti dvom NEPODMIENENÝM pravidlám
    #    nižšie (long_run_rule vždy pridalo 1 long run pre main_sport;
    #    sports_restriction vždy explicitne vypísalo main_sport ako
    #    "ALLOWED") — model mal teda dve protirečiace si inštrukcie a
    #    v praxi sa riadil tou nižšie/konkrétnejšou. Teraz sú long_run_rule,
    #    multi_sport_rule aj sports_restriction podmienené a explicitne
    #    odkazujú späť na ATHLETE INSTRUCTIONS, takže si už neprotirečia.
    coach_notes = _as_dict(context_payload.get("coach_notes"))
    sticky_notes = coach_notes.get("sticky_notes") or []
    ephemeral_note = coach_notes.get("ephemeral_note")

    notes_rule = ""
    if sticky_notes or ephemeral_note:
        lines = [
            "--- ATHLETE INSTRUCTIONS (HIGHEST PRIORITY — OVERRIDES EVERYTHING BELOW) ---",
            "The athlete has left direct instructions below. These OVERRIDE the default "
            "main_sport, ALLOWED SPORTS, LONG RUN, and MULTI-SPORT rules that follow later "
            "in this prompt, even though those rules will mention the athlete's usual main "
            "sport by name (e.g. 'Main Sport: run'). A label further down saying a sport is "
            "the 'main sport' or 'allowed' does NOT cancel an exclusion stated here.",
            "",
            "CRITICAL ENFORCEMENT RULES:",
            "1. If an instruction restricts or excludes a sport (e.g. 'no running this week', "
            "'skip cycling', 'chcem pokoj od behania'), you MUST NOT schedule ANY session for "
            "that sport this week — including long runs, easy runs, or recovery runs — even "
            "though it is listed as the athlete's main_sport elsewhere in this prompt.",
            "2. It is ALWAYS better to schedule FEWER sessions (or more rest days, or more of "
            "an allowed sport like strength) than to violate an athlete instruction. Do not "
            "'fill the gap' with the restricted sport just to hit a volume or session-count "
            "target, and do not treat the excluded sport's usual weekly minutes as something "
            "that must be replaced 1:1 by another sport.",
            "3. If you add an alternative activity that is not strictly required to replace the "
            "restricted sport (e.g. a light walk), it MUST be clearly marked as optional in "
            "`notes` (e.g. 'Voliteľná prechádzka, ak sa cítiš na to' / 'Optional, only if you feel like it').",
            "4. If the instruction leaves only one sport realistically available (e.g. only "
            "strength remains after excluding running and the athlete does not cycle/swim), "
            "plan ONLY that sport plus rest days — do not invent sessions for other sports to "
            "compensate, and it is fine for the week to have fewer total sessions than usual.",
            "5. Exception — safety ceiling: if an instruction requests something excessive or "
            "unsafe (e.g. running a marathon distance every day, zero rest days for weeks), "
            "do NOT follow it literally. Instead, honor its clear underlying intent (more of "
            "that sport / higher priority for it) within safe volume and recovery limits from "
            "`athlete_state.ai_state.volume_tolerance`, and briefly note in `notes` why it was "
            "moderated. This exception applies ONLY to unsafe volume/intensity requests — it "
            "does NOT apply to requests to REDUCE or EXCLUDE a sport (rule 1 always applies in full).",
            "",
        ]
        if sticky_notes:
            lines.append("Permanent (every plan):")
            for i, n in enumerate(sticky_notes, 1):
                lines.append(f"  {i}. {n}")
        if ephemeral_note:
            lines.append(f"\nOne-time instruction for THIS week only:\n  → {ephemeral_note}")
        notes_rule = "\n".join(lines) + "\n\n"

    sports_restriction = (
        f"- ALLOWED SPORTS (default, before athlete instructions): {', '.join(final_sports_list)}. "
        "ONLY populate sessions for listed sports. IMPORTANT: if ATHLETE INSTRUCTIONS above "
        "restrict or exclude one of these sports (including the main sport), that exclusion "
        "takes full priority over this list — remove the excluded sport from consideration "
        "entirely, do not just reduce it.\n\n"
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
        f"Main Sport (default, may be overridden by ATHLETE INSTRUCTIONS below): {main_sport}\n"
        f"All Sports (default, may be overridden by ATHLETE INSTRUCTIONS below): {', '.join(final_sports_list)}\n"
        f"External events: {ext_count}\n\n"
        # 🌟 notes_rule ide hneď po základných info riadkoch — pred DATE
        # INTEGRITY aj pred akoukoľvek default sport/rest logikou, aby mala
        # model najvyššiu prioritu pri čítaní promptu.
        + notes_rule
        + "- DATE INTEGRITY: Use ONLY dates inside the given Week range.\n\n"
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
        + _time_format_rule()
        + _terminology_rule(lang_label)
        + endurance_structure_rule
        + strength_structure_rule
        + strength_focus_rule
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
