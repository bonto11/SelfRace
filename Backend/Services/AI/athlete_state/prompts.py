# Services/AI/athlete_state/prompts.py
from __future__ import annotations

import json
from datetime import datetime, timezone, date
from typing import Any, Dict, List, Optional, Tuple

from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPERS
# ============================================================

def _remove_empty(d: Any) -> Any:
    """Rekurzívne vymaže None, [], {} — menej tokenov."""
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    """Vráti (jazyk_label, pravidlo_oslovovania) podľa nastavení."""
    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def _time_format_rule() -> str:
    """
    Spoločné pravidlo pre formátovanie akéhokoľvek času/trvania vo voľnom texte.
    Platí pre headline, bullets, comment a všetky ostatné free-text polia,
    kdekoľvek sa spomína čas odvodený zo sekúnd (paces, race times, atď.).
    """
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration or time value "
        "(paces, race time estimates, splits, etc) in free text. Always format as human-readable time: "
        "use 'M:SS' when under an hour (e.g. 319 seconds -> '5:19', 196 seconds -> '3:16'), "
        "and 'H:MM:SS' when an hour or more (e.g. 17813 seconds -> '4:56:53'). "
        "If minutes or hours are zero, omit that unit rather than writing a leading zero segment "
        "(e.g. 45 seconds -> '0:45', not '00:00:45'). "
        "Paces specifically should be written as 'mm:ss/km'.\n"
    )


def _duration_minutes_format_rule() -> str:
    """
    Pravidlo pre formátovanie tréningového objemu/trvania zadaného v MINÚTACH
    (napr. weekly_minutes_min/max, celkový týždenný objem) vo voľnom texte.
    Odlišné od _time_format_rule(), ktoré rieši sekundy (tempá, časy pretekov).
    """
    return (
        "- VOLUME/DURATION IN MINUTES FORMAT: Never write raw minute values for training volume or duration "
        "in free text (e.g. do NOT write '573 minút'). Always convert to hours and minutes: "
        "use 'H h MM min' format (e.g. 573 minutes -> '9 h 33 min', 90 minutes -> '1 h 30 min'). "
        "Omit the hours part if it is zero (e.g. 45 minutes -> '45 min'), and omit the minutes part "
        "if it is exactly zero (e.g. 120 minutes -> '2 h', not '2 h 0 min').\n"
    )


def _terrain_variability_rule() -> str:
    """
    Pravidlo, aby AI nezamieňala terénnu variabilitu tempa (kopce, trail) so
    skutočnou únavou/rizikom preťaženia.
    """
    return (
        "- TERRAIN-AWARE VARIABILITY: If last_activities/segments show trail or hilly running "
        "(elevation gain, technical/uneven terrain), do NOT interpret the resulting pace or HR "
        "variability (slower uphill, faster downhill, uneven splits) as fatigue or injury risk on its own. "
        "Terrain-driven pace changes are expected and normal. Only raise fatigue_level or injury_risk based on "
        "genuine physiological signals — e.g. elevated HR at easy effort, declining performance across comparable "
        "terrain/conditions over time, poor recovery trends, or explicit subjective signals — not from pace "
        "variability caused by elevation or technical terrain alone.\n"
    )


def _terminology_rule(lang_label: str) -> str:
    """
    Zabráni prenikaniu anglických koučovacích termínov do SK/CS textu.
    """
    if lang_label == "English":
        return ""
    if lang_label == "Czech":
        return (
            "- TERMINOLOGY: Do NOT leave English coaching terms untranslated in free text. Use Czech equivalents, "
            "for example: 'fatigue' -> 'únava', 'hard session(s)' -> 'náročný trénink / náročné tréninky', "
            "'threshold' -> 'práh / prahový', 'recovery' -> 'regenerace', 'base' -> 'základ / základní fáze', "
            "'volume' -> 'objem', 'intensity' -> 'intenzita', 'injury risk' -> 'riziko zranění', 'block' -> 'blok', "
            "'taper' -> 'tapering / odlehčení'. Never mix untranslated English jargon into Czech sentences.\n"
        )
    return (
        "- TERMINOLOGY: Do NOT leave English coaching terms untranslated in free text. Use Slovak equivalents, "
        "for example: 'fatigue' -> 'únava', 'hard session(s)' -> 'náročný tréning / náročné tréningy', "
        "'threshold' -> 'prah / prahový', 'recovery' -> 'regenerácia', 'base' -> 'základ / základná fáza', "
        "'volume' -> 'objem', 'intensity' -> 'intenzita', 'injury risk' -> 'riziko zranenia', 'block' -> 'blok', "
        "'taper' -> 'tapering / odľahčenie'. Never mix untranslated English jargon into Slovak sentences.\n"
    )


def _no_raw_technical_values_rule() -> str:
    """
    Zabráni tomu, aby interné boolean hodnoty/field names unikli priamo do
    voľného textu (napr. "zmena z false na true").
    """
    return (
        "- NO RAW TECHNICAL VALUES IN TEXT: Never write literal booleans, field names, or internal codes "
        "in free text (e.g. do NOT write 'true', 'false', 'should_soften', 'zmena z false na true', "
        "'weekly_replan_reason'). Always translate such internal state into a meaningful, human-readable sentence "
        "explaining what actually changed and why it matters to the athlete "
        "(e.g. instead of 'soften_next_days: false -> true', explain that the plan will now be softened over the "
        "next days because of detected fatigue).\n"
    )


PB_VALID_DAYS = 180  # hranica "aktuálny" vs "potenciál" pre osobné rekordy


def _pb_validity_rule() -> str:
    """
    Vysvetlí AI, ako pracovať s bests, ktoré sú označené is_expired=true
    (staršie ako PB_VALID_DAYS) — má ich brať ako signál dlhodobého
    potenciálu, nie ako aktuálny fyzický stav.
    """
    return (
        "- PERSONAL BEST VALIDITY: Each entry in 'bests' has 'days_ago' and 'is_expired'. "
        "Entries with is_expired=true are OLD (over 180 days) and must NOT be treated as the athlete's "
        "current ability or used to calibrate current paces/capability level. Treat them only as evidence "
        "of long-term potential/ceiling — if you reference one in free text, explicitly mention its age "
        "(e.g. 'pred X mesiacmi si dosiahol...') and frame it as past potential, never as a current state. "
        "Only entries with is_expired=false represent current fitness and may be used for calibration.\n"
    )


def _days_until(date_str: Optional[str]) -> Optional[int]:
    """Vráti počet dní do dátumu od dnes."""
    if not date_str:
        return None
    try:
        target = date.fromisoformat(str(date_str)[:10])
        return (target - date.today()).days
    except Exception:
        return None


# ============================================================
# MINIFIKÁCIA KONTEXTU
# ============================================================

def minify_analyze_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva analyze context pred odoslaním do AI.
    Optimalizácie:
    - latest_paces: odstráni DB metadata (id, user_id, measured_at)
    - external_events: posiela len ak má reálne eventy
    - recent_load: max 4 týždne (nie 6-7)
    - bests: preskočí záznamy staršie ako 180 dní (outdated)
    - prefs.targets: odstráni sporty ktoré nie sú v main/add_on_sports
    - races: pridá days_until_race pre lepší kontext AI
    - last_activities: max 10, bez interných ID
    """
    if not isinstance(context, dict):
        return {}
    out: Dict[str, Any] = json.loads(json.dumps(context, default=str))

    # --- User — odstráni interné polia ---
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email", "name"):
            u.pop(k, None)

    # --- Prefs — odstráni external_activities, nerelevantné sporty ---
    prefs = out.get("prefs")
    if isinstance(prefs, dict):
        pv = prefs.get("value")
        if isinstance(pv, dict):
            pv.pop("external_activities", None)
        prefs.pop("external_activities", None)

        # Zisti povolené sporty
        main_sport = prefs.get("main_sport") or ""
        add_on = prefs.get("add_on_sports") or []
        allowed_sports = {main_sport.lower()} | {s.lower() for s in add_on if isinstance(s, str)}

        # Targets — odstráni sporty mimo allowed + pridá days_until_race
        targets = prefs.get("targets")
        if isinstance(targets, dict):
            cleaned_targets: Dict[str, Any] = {}
            for sport_key, sport_val in targets.items():
                # Swim/iné sporty čo nie sú v allowed — preskočí
                if sport_key not in ("strength",) and sport_key not in allowed_sports:
                    continue
                if not isinstance(sport_val, dict):
                    continue

                # Races — pridá days_until_race
                races = sport_val.get("races")
                if isinstance(races, list):
                    minified_races = []
                    for r in races:
                        if not isinstance(r, dict):
                            continue
                        race_date = r.get("date") or r.get("start_date")
                        days_left = _days_until(race_date)
                        minified_races.append({
                            "name": r.get("name"),
                            "date": race_date,
                            "days_until_race": days_left,
                            "race_goal": r.get("race_goal"),
                            "race_type": r.get("race_type"),
                            "target_time": r.get("target_time"),
                            "custom_distance_km": r.get("custom_distance_km"),
                            "elevation_gain_m": r.get("elevation_gain_m"),
                            "terrain": r.get("terrain"),
                            "priority": r.get("priority"),
                        })
                    sport_val = dict(sport_val)
                    sport_val["races"] = minified_races

                cleaned_targets[sport_key] = sport_val
            prefs["targets"] = cleaned_targets

    # --- Streamy, laps, splits nepatria sem ---
    for k in ("streams", "laps", "splits"):
        out.pop(k, None)

    # --- recent_load — max 4 týždne (nie 6-7) ---
    recent_load = out.get("recent_load")
    if isinstance(recent_load, dict):
        weeks = recent_load.get("weeks")
        if isinstance(weeks, list):
            # Zachovaj len posledné 4 týždne (week_index_from_now >= -4)
            recent_load["weeks"] = [
                w for w in weeks
                if isinstance(w, dict) and int(w.get("week_index_from_now", -99)) >= -4
            ]

    # --- bests — pridá is_expired flag namiesto tvrdého orezania na 180 dní ---
    # POZOR: chýbajúci "days_ago" sa NESMIE brať ako 0 (dnes) — to bol bug,
    # kvôli ktorému staré rekordy bez vyplneného days_ago prešli ako čerstvé.
    # Chýbajúci údaj = neznámy vek = radšej ho označiť ako expired (fail-safe).
    bests = out.get("bests")
    if isinstance(bests, dict):
        for sport_key, items in bests.items():
            if not isinstance(items, list):
                continue
            cleaned_items: List[Dict[str, Any]] = []
            for b in items:
                if not isinstance(b, dict):
                    continue
                raw_days_ago = b.get("days_ago")
                if raw_days_ago is None:
                    days_ago = None
                else:
                    try:
                        days_ago = int(raw_days_ago)
                    except (TypeError, ValueError):
                        days_ago = None
                # neznámy vek -> fail-safe, nech to AI nepovažuje za čerstvé
                is_expired = days_ago is None or days_ago > PB_VALID_DAYS
                # ignoruj úplne extrémne staré/nevalidné (>365 dní) — už nedávajú zmysel ani ako "potenciál"
                if days_ago is not None and days_ago > 365:
                    continue
                b2 = dict(b)
                b2["days_ago"] = days_ago
                b2["is_expired"] = is_expired
                cleaned_items.append(b2)
            bests[sport_key] = cleaned_items

    # --- latest_paces — odstráni DB metadata ---
    paces = out.get("latest_paces")
    if isinstance(paces, dict):
        out["latest_paces"] = {
            k: v for k, v in paces.items()
            if k not in ("id", "user_id", "measured_at")
        }

    # --- external_events — posiela len ak má reálne eventy ---
    ext = out.get("external_events")
    if isinstance(ext, dict):
        events = ext.get("events")
        if not events:
            win = ext.get("window")
            if isinstance(win, dict):
                events = win.get("events")
        if not events:
            # Prázdny blok — vymaž
            out.pop("external_events", None)

    # --- last_activities — max 10, bez interných ID ---
    la = out.get("last_activities")
    if isinstance(la, list):
        cleaned: List[Dict[str, Any]] = []
        for it in la:
            if not isinstance(it, dict):
                continue
            it2 = dict(it)
            it2.pop("activity_id", None)
            it2.pop("name", None)
            cleaned.append(it2)
            if len(cleaned) >= 10:
                break
        out["last_activities"] = cleaned

    # --- user_settings — len relevantné polia ---
    us = out.get("user_settings")
    if isinstance(us, dict):
        out["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }

    return _remove_empty(out)


def _minify_state_for_progress(state: dict) -> dict:
    """Pre progress report potrebujeme len ai_state a user_summary."""
    if not isinstance(state, dict):
        return {}
    return _remove_empty({
        "ai_state": state.get("ai_state"),
        "user_summary": state.get("user_summary"),
    })


# ============================================================
# PROMPTS: ANALYZE
# ============================================================

def build_prompts_for_analyze(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre athlete state analýzu.
    Detekuje detraining, beginner stav a prispôsobí inštrukcie.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    context2 = dict(context_payload) if isinstance(context_payload, dict) else {}
    context2["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }
    context_for_llm = minify_analyze_context_for_ai(context2)

    # Prefs
    prefs = context_for_llm.get("prefs") or {}
    prefs2 = prefs.get("value", prefs) if isinstance(prefs, dict) else {}
    weeks = int(prefs2.get("weeks") or 4)
    main_sport = prefs2.get("main_sport") or "run"
    is_beginner = bool(context_for_llm.get("is_returning_beginner"))

    # LTHR pre explicitné pravidlo zón
    thresholds = context_for_llm.get("thresholds") or {}
    run_thresh = thresholds.get("run") or {}
    lthr = run_thresh.get("lthr_bpm")
    lthr_rule = (
        f"- THRESHOLD RULE: LTHR = {lthr} bpm = Z4/Z5 boundary. "
        "Threshold/Prahový sessions target Z4. NEVER prescribe Z3 for threshold sessions.\n"
        if lthr else ""
    )

    # Najbližší pretek
    targets = prefs2.get("targets") or {}
    run_target = targets.get("run") or {}
    races = run_target.get("races") or []
    next_race = min(
        (r for r in races if isinstance(r, dict) and r.get("days_until_race") is not None and r["days_until_race"] >= 0),
        key=lambda r: r["days_until_race"],
        default=None,
    )
    race_hint = (
        f"- NEXT RACE: {next_race.get('name')} in {next_race.get('days_until_race')} days "
        f"({next_race.get('custom_distance_km')} km, {next_race.get('elevation_gain_m')} m elev). "
        "Factor this into block recommendation and fatigue management.\n"
        if next_race else ""
    )

    # Detekcia detraining
    last_acts = context_for_llm.get("last_activities") or []
    days_since_last_run = _get_days_since_last_run(last_acts)
    detraining_hint = _build_detraining_hint(days_since_last_run)

    beginner_hint = (
        "- USER IS DETECTED AS BEGINNER/RETURNING. Assign capabilities.run.level_1_to_5 = 1.\n"
        if is_beginner else ""
    )

    system_txt = (
        "You are an endurance coaching assistant for runners and multisport athletes. "
        "You receive structured JSON about an athlete. "
        "Your task is to analyze the current training state and return a SINGLE valid JSON object. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = _analyze_schema(lang_label)

    user_txt = (
        f"Analyze the athlete context JSON and fill the schema.\n"
        f"The main sport is: {main_sport}.\n"
        f"The upcoming horizon is about {weeks} weeks.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema.\n"
        "- NO PARROTING: Do NOT output acute_load_score or chronic_load_score in the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        "- Use recent_load, recovery, external_events and last_activities for fatigue/injury risk.\n"
        "- SEGMENTS: If 'segments' are present in last_activities, use them to assess pacing consistency and capability.\n"
        + _time_format_rule()
        + _duration_minutes_format_rule()
        + _terminology_rule(lang_label)
        + _no_raw_technical_values_rule()
        + _terrain_variability_rule()
        + _pb_validity_rule()
        + lthr_rule
        + race_hint
        + beginner_hint
        + detraining_hint
        + "\nCRITICAL INSTRUCTIONS FOR 'estimated_paces':\n"
        "1. NO RUNS = NO UPDATE (UNLESS DETRAINING).\n"
        "2. DO NOT USE OVERALL AVG PACE FOR INTERVALS.\n"
        "3. EVALUATE SEGMENTS: Use distance, pace and HR to judge capability.\n"
        "4. EVOLUTION, NOT REVOLUTION.\n"
        "5. REALITY CHECK: Z1 pace should never exceed 7:30 min/km if 5K is < 25 min.\n"
    )

    return system_txt, user_txt


# ============================================================
# PROMPTS: PROGRESS
# ============================================================

def build_prompts_for_progress(
    previous_state: dict,
    current_state: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre progress porovnanie dvoch stavov.
    Posiela len ai_state a user_summary — nie celý kontext.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    context_for_llm = {
        "previous_state": _minify_state_for_progress(previous_state),
        "current_state": _minify_state_for_progress(current_state),
        "user_settings": {
            "language": settings.get("language"),
            "timezone": settings.get("timezone"),
        },
    }

    system_txt = (
        "You are an endurance coaching assistant that compares two athlete state JSON objects. "
        "Return a SINGLE valid JSON object describing meaningful changes. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = _progress_schema(lang_label)

    user_txt = (
        "Compare previous_state vs current_state and fill the schema.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- NO PARROTING. Do NOT parrot back fields if they haven't changed meaningfully.\n"
        "- Always return exactly one JSON object matching the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        "- Keep string arrays short and impactful.\n"
        + _time_format_rule()
        + _duration_minutes_format_rule()
        + _terminology_rule(lang_label)
        + _no_raw_technical_values_rule()
        + _terrain_variability_rule()
        + "- If possible, extract and compare estimated_vo2max from metrics.\n"
    )

    return system_txt, user_txt


# ============================================================
# SCHEMAS
# ============================================================

def _analyze_schema(lang_label: str) -> str:
    """JSON schéma pre athlete state analýzu."""
    return f"""
{{
  "user_summary": {{
    "headline": "1 punchy sentence in {lang_label}, 2nd person",
    "bullets": ["max 3 short points"],
    "risks": ["max 2 short points"],
    "suggestions_short": ["max 3 short points"]
  }},
  "ai_state": {{
    "capabilities": {{
      "run":      {{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", "comment": "max 1 sentence" }},
      "ride":     {{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", "comment": "max 1 sentence" }} | null,
      "strength": {{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", "comment": "max 1 sentence" }} | null
    }},
    "fatigue_level": "low" | "moderate" | "high",
    "injury_risk": "low" | "moderate" | "high",
    "volume_tolerance": {{ "weekly_minutes_min": number | null, "weekly_minutes_max": number | null, "note": "max 1 sentence" }},
    "intensity_tolerance": {{ "hard_sessions_per_week_max": number | null, "comment": "max 1 sentence" }},
    "suggested_block_kind": "base_aerobic" | "base_long" | "threshold_speed" | "regeneration" | "race_specific" | string,
    "metrics": {{
      "estimated_vo2max": number | null,
      "estimated_5k_time_s": number | null,
      "estimated_10k_time_s": number | null,
      "estimated_half_marathon_time_s": number | null,
      "estimated_marathon_time_s": number | null
    }},
    "estimated_paces": {{
      "z1_pace_s": number | null,
      "z2_pace_s": number | null,
      "z3_pace_s": number | null,
      "z4_pace_s": number | null,
      "z5_pace_s": number | null,
      "best_1k_s": number | null
    }},
    "plan_adjustment": {{
      "soften_next_days": {{ "should_soften": boolean, "days": number | null, "reason": "max 1 sentence" }},
      "should_replan_weekly": boolean,
      "weekly_replan_reason": "max 1 sentence" | null,
      "should_notify_user": boolean,
      "notify_message": "max 1 sentence" | null
    }}
  }}
}}
""".strip()


def _progress_schema(lang_label: str) -> str:
    """JSON schéma pre progress porovnanie."""
    return f"""
{{
  "summary": {{
    "headline": "1 short punchy sentence in {lang_label}, 2nd person",
    "bullets": ["max 3 short points"]
  }},
  "comparisons": {{
    "fatigue_level": {{ "previous": "low"|"moderate"|"high"|null, "current": "low"|"moderate"|"high"|null, "comment": "max 1 sentence" }},
    "injury_risk": {{ "previous": "low"|"moderate"|"high"|null, "current": "low"|"moderate"|"high"|null, "comment": "max 1 sentence" }},
    "block_kind": {{ "previous": string|null, "current": string|null, "comment": "max 1 sentence" }},
    "vo2max": {{ "previous": number|null, "current": number|null, "comment": "max 1 sentence" }} | null,
    "volume_tolerance": {{
      "previous_weekly_minutes_min": number|null, "previous_weekly_minutes_max": number|null,
      "current_weekly_minutes_min": number|null, "current_weekly_minutes_max": number|null,
      "comment": "max 1 sentence"
    }},
    "plan_adjustment": {{ "soften_change": string|null, "weekly_replan_change": string|null }}
  }},
  "recommendations": {{
    "celebrations": ["max 2 short points"],
    "risks_to_watch": ["max 2 short points"],
    "focus_next_weeks": ["max 2 short points"]
  }}
}}
""".strip()


# ============================================================
# DETRAINING DETECTION
# ============================================================

def _get_days_since_last_run(last_acts: List[Dict[str, Any]]) -> int:
    """Vytiahne počet dní od posledného behu z last_activities bloku."""
    for a in last_acts:
        if not isinstance(a, dict) or a.get("sport") != "run":
            continue
        date_label = str(a.get("date", ""))
        if date_label == "today":
            return 0
        if date_label.startswith("today-"):
            try:
                return int(date_label.split("-")[1])
            except ValueError:
                pass
    return 999


def _build_detraining_hint(days_since_last_run: int) -> str:
    """Vráti inštrukciu pre AI podľa počtu dní bez behu."""
    if days_since_last_run <= 0:
        return ""
    if days_since_last_run <= 10:
        return (
            "\n- RECOVERY/DELOAD DETECTED: Fitness is maintained. "
            "Do NOT degrade paces or race estimates.\n"
        )
    if days_since_last_run <= 21:
        return (
            "\n- MILD DETRAINING DETECTED: Slightly degrade intensive paces (Z4, Z5) "
            "by 2-5 sec/km and add some time to race estimates.\n"
        )
    return (
        "\n- SIGNIFICANT DETRAINING DETECTED: Noticeable loss of fitness. "
        "Degrade all paces by 10-20 sec/km, significantly increase race estimates, "
        "and lower VO2max.\n"
    )