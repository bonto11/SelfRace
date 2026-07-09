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

    # --- bests — preskočí záznamy staršie ako 180 dní ---
    bests = out.get("bests")
    if isinstance(bests, dict):
        for sport_key, items in bests.items():
            if not isinstance(items, list):
                continue
            bests[sport_key] = [
                b for b in items
                if isinstance(b, dict) and int(b.get("days_ago", 0)) <= 180
            ]

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