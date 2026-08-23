# Services/AI/weekly_plan/prompts.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple
from datetime import date


# ============================================================
# HELPERS
# ============================================================

def _as_dict(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _as_list(v: Any) -> List[Any]:
    return v if isinstance(v, list) else []


def _get_dict(d: Dict[str, Any], key: str) -> Dict[str, Any]:
    return _as_dict(d.get(key))


def _safe_date(v: Any) -> Optional[str]:
    if not v:
        return None
    s = str(v).strip()
    return s[:10] if len(s) >= 10 else None


def _days_until(date_str: Optional[str]) -> Optional[int]:
    """Počet dní do dátumu od dnes."""
    if not date_str:
        return None
    try:
        return (date.fromisoformat(str(date_str)[:10]) - date.today()).days
    except Exception:
        return None


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
    """Vráti (jazyk_label, pravidlo_oslovovania)."""
    lang_code = str(settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def _time_format_rule() -> str:
    """
    Spoločné pravidlo pre formátovanie akéhokoľvek trvania vo voľnom texte
    (goal, notes). Zabraňuje AI písať surové sekundy namiesto čitateľného formátu,
    ak by v texte spomenulo konkrétny čas (napr. cieľový čas dlhého behu, tempo).
    """
    return (
        "- TIME/DURATION FORMAT: If mentioning any specific duration or target time in "
        "'goal' or 'notes' (not the numeric planned_stats fields), never write raw seconds. "
        "Format as 'M:SS' under an hour (e.g. '5:19'), 'H:MM:SS' for an hour or more. "
        "Pace is always 'mm:ss/km'.\n"
    )


def _week_boundaries_rule(week_boundaries: List[Dict[str, Any]], is_replan: bool) -> str:
    """
    Kritické pravidlo: AI NESMIE počítať kalendárne dátumy/dni v týždni sama
    (LLM na to nie sú spoľahlivé - viedlo to k nesprávnemu určeniu dňa v týždni,
    napr. pri identifikácii dňa preteku). Presné hranice každého týždňa (vždy
    pondelok-nedeľa, okrem prípadne kratšieho prvého týždňa) sú vypočítané
    v Pythone a musia sa použiť doslovne, nie prepočítavať.

    Explicitne tiež označuje, ktorý week_index zodpovedá DNEŠKU - keď atlét
    v coach_notes píše "tento týždeň", myslí presne tento week_index.

    Pri REPLANE week_index NEZAČÍNA na 1 - pokračuje od existujúceho čísla
    (napr. ak už prebehli týždne 1-2, prvý týždeň v tomto zozname môže byť
    week_index 3). AI generuje LEN tieto vymenované týždne, nič naviac a nič
    s nižším week_index.

    🌟 EXPLICITNÝ POČET: pridané tvrdé pravidlo "output EXACTLY N weeks" -
    predtým sa stávalo, že pri skrátenom pláne (athlete zvolil skorší
    target_end_date cez date picker) si AI aj tak dogenerovala vlastný
    recovery/nový base blok NAVYŠE za posledný požadovaný týždeň, akoby
    dostala voľnú ruku na dĺžku. Backend síce takéto navyše týždne teraz
    tvrdo zahadzuje (hard truncation v main.py), ale je lepšie, ak sa tomu
    AI vyhne už v generovaní.
    """
    if not week_boundaries:
        return ""
    n = len(week_boundaries)
    lines = ["\n--- WEEK BOUNDARIES (CRITICAL - DO NOT RECALCULATE) ---"]
    if is_replan:
        lines.append(
            "This is a REPLAN of an existing plan. Earlier weeks (lower week_index than "
            "listed below) already happened and are CLOSED - do NOT generate them, do NOT "
            "reuse their week_index numbers. Generate ONLY the exact week_index values "
            "listed below, starting from the current week."
        )
    lines.append(
        f"You MUST output EXACTLY {n} week object(s) in the 'weeks' array - one for each "
        f"week_index listed below, NO MORE and NO FEWER. This is a HARD LIMIT, not a "
        f"suggestion. Do NOT add extra weeks for a new training block, a post-race recovery "
        f"phase, or anything else beyond this exact list - even if the plan feels "
        f"'incomplete' to you, even if a race falls near the last listed week, and even if "
        f"you would normally continue periodization further. If the athlete wanted the plan "
        f"shortened to end here, respect that exactly - do not compensate by extending it."
    )
    lines.append(
        "You MUST use these EXACT week_start/week_end dates for each week_index. "
        "Do NOT calculate, adjust, or guess calendar dates or weekdays yourself — "
        "LLMs are unreliable at this and it causes wrong race-day weekday "
        "identification. Copy these values verbatim into your output:"
    )
    today_iso = date.today().isoformat()
    current_week_index: Optional[int] = None
    for wb in week_boundaries:
        marker = ""
        if wb["week_start"] <= today_iso <= wb["week_end"]:
            current_week_index = wb["week_index"]
            marker = "  <-- TODAY falls in this week"
        lines.append(
            f"  - week_index {wb['week_index']}: {wb['week_start']} to {wb['week_end']}{marker}"
        )
    lines.append(
        f"\nThe list above has exactly {n} entries. Your 'weeks' array must have exactly "
        f"{n} entries too, with week_index values matching this list one-to-one - no other "
        f"week_index is valid."
    )
    if current_week_index is not None:
        lines.append(
            f"\nCRITICAL: Today is {today_iso}, which is week_index {current_week_index}. "
            f"When the athlete's notes say 'this week', 'tento týždeň', 'aktuálny týždeň', "
            f"or similar, they mean week_index {current_week_index} EXACTLY — not any other "
            f"week. When they say 'next week', 'ďalší týždeň', they mean week_index "
            f"{current_week_index + 1}. Do not misassign the deload/build phase to the "
            f"wrong week_index — this is a common and critical mistake to avoid."
        )
    return "\n".join(lines) + "\n"


def _past_weeks_summary_rule(past_weeks: List[Dict[str, Any]]) -> str:
    """
    Krátky súhrn už uzavretých minulých týždňov (pri replane) - AI ich
    NEGENERUJE znova, ale môže sa na periodizáciu odvolávať (napr. vedieť
    že predošlý týždeň bol build, takže tento môže byť recovery).
    """
    if not past_weeks:
        return ""
    lines = ["\n--- PAST WEEKS (ALREADY HAPPENED, READ-ONLY CONTEXT) ---"]
    lines.append(
        "These weeks already occurred and are closed. Do NOT include them in your "
        "output. Use them only to understand recent periodization/training history:"
    )
    for w in past_weeks:
        phase = w.get("load_phase") or "?"
        goal = w.get("goal") or ""
        lines.append(
            f"  - week_index {w.get('week_index')} ({w.get('week_start')} to "
            f"{w.get('week_end')}): {phase} — {goal}"
        )
    return "\n".join(lines) + "\n"


def _target_end_date_rule(target_end_date: Optional[str], week_boundaries: List[Dict[str, Any]]) -> str:
    """
    🌟 Athlete si v UI (date picker, Coach Notes -> Veľká zmena) explicitne
    zvolil, kedy má plán skončiť. Toto je len INFORMATÍVNE pre AI (aby vedela
    prečo je plán krátky a mohla to zohľadniť v coach_reply/poslednom
    týždni - napr. správne umiestniť taper), samotný počet týždňov je už
    definitívne vyriešený cez week_boundaries vyššie.
    """
    if not target_end_date or not week_boundaries:
        return ""
    return (
        "\n--- ATHLETE-CHOSEN PLAN END DATE ---\n"
        f"The athlete explicitly chose {target_end_date} as the new end date for this plan "
        "(via a date picker) - this is WHY the week list above is short/shortened. Design the "
        "last listed week appropriately for this being the END of the plan (e.g. taper if a "
        "race falls near it, or a sensible wind-down otherwise) - but still do NOT add any "
        "week beyond the last one listed above.\n"
    )


# ============================================================
# PREFS EXTRACTION
# ============================================================

def _extract_prefs_source(context: Dict[str, Any]) -> Dict[str, Any]:
    """Vytiahne prefs z contextu — skúša analyze_input_min, analyze_input, root."""
    for source_key in ("analyze_input_min", "analyze_input"):
        src = _as_dict(context.get(source_key))
        prefs = src.get("prefs")
        if isinstance(prefs, dict):
            val = prefs.get("value")
            return _as_dict(val) if isinstance(val, dict) else prefs
    prefs = context.get("prefs")
    if isinstance(prefs, dict):
        val = prefs.get("value")
        return _as_dict(val) if isinstance(val, dict) else prefs
    return {}


# ============================================================
# WEEKLY TEMPLATE
# ============================================================

def _derive_key_slots_from_weekly_template(
    wt: Dict[str, Any], max_fixed: int = 10
) -> List[Dict[str, Any]]:
    """Vytiahne key sloty z weekly_template — pre AI aby vedela fixné tréningové dni."""
    days = _as_list(wt.get("days"))
    out: List[Dict[str, Any]] = []
    for d in days:
        d2 = _as_dict(d)
        day = d2.get("day")
        slots = _as_list(d2.get("slots"))
        if not isinstance(day, str):
            continue
        for s in slots:
            s2 = _as_dict(s)
            if s2.get("priority") != "key":
                continue
            sport = s2.get("sport")
            kind = s2.get("kind")
            if not (isinstance(sport, str) and isinstance(kind, str)):
                continue
            out.append({"weekday": day, "sport": sport, "kind": kind})
            if len(out) >= max_fixed:
                return out
    return out


# ============================================================
# WOMEN'S HEALTH
# ============================================================

def _build_womens_health_rule(
    preferences_obj: Dict[str, Any],
    start_date: Optional[str],
) -> str:
    """Vráti inštrukciu pre cycle sync ak je aktivovaná a dátum sedí."""
    womens_health = _get_dict(preferences_obj, "womens_health")
    if not womens_health.get("sync_enabled"):
        return ""
    next_cycle_start_str = womens_health.get("next_cycle_start")
    if not next_cycle_start_str:
        return ""
    try:
        cycle_length = int(womens_health.get("cycle_length_days") or 28)
        plan_start_dt = date.fromisoformat(start_date) if start_date else date.today()
        cycle_start_dt = date.fromisoformat(next_cycle_start_str[:10])
        diff_days = (plan_start_dt - cycle_start_dt).days
        days_into_cycle = abs(diff_days) % cycle_length
        if 0 <= days_into_cycle <= 7:
            return (
                "\n--- WOMEN'S HEALTH (CYCLE SYNC) ---\n"
                "- The athlete's menstrual cycle starts this week.\n"
                "- Make this week a TAPER / RECOVERY week.\n"
                "- Lower volume by 20-30%, prioritize Z1/Z2, avoid max intensity.\n"
                "- Remind her gently in 'notes' that this is an expected lighter week.\n"
            )
    except Exception:
        pass
    return ""


# ============================================================
# MINIFY CONTEXT
# ============================================================

def minify_weekly_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva weekly context pred odoslaním do AI.
    Zmeny v tejto verzii:
    - Races: pridané days_until_race, elevation_gain_m, custom_distance_km, terrain — kritické pre ultra plánovanie
    - Strength: strength_settings.sessions_per_week sa teraz posiela explicitne (predtým sa stratilo)
    - External events: posiela sa len ak má reálne eventy (nie prázdny window)
    - athlete_state: odstránený plan_adjustment (nie je relevantný pre weekly builder)
    - coach_notes: sticky + ephemeral (bez ephemeral_note_id)
    """
    context = _as_dict(context)
    ctx2: Dict[str, Any] = {}

    raw_prefs = _extract_prefs_source(context)
    preferences = _get_dict(raw_prefs, "preferences")
    volume = _get_dict(raw_prefs, "volume")
    targets = _get_dict(raw_prefs, "targets")
    run_t = _get_dict(targets, "run")
    strength_t = _get_dict(targets, "strength")

    # Strength settings — z prefs.strength_settings (nie targets.strength ktorý môže byť prázdny)
    strength_settings = _get_dict(raw_prefs, "strength_settings")
    strength_sessions = None
    if strength_settings:
        try:
            raw = strength_settings.get("sessions_per_week")
            if raw is not None:
                strength_sessions = int(raw)
        except Exception:
            pass

    # Races — kompletné info vrátane elevation a distance (kritické pre ultra/mountain)
    races_raw = run_t.get("races")
    races_min: Optional[List[Dict[str, Any]]] = None
    if isinstance(races_raw, list):
        races_min = []
        for r in races_raw:
            r2 = _as_dict(r)
            if not r2:
                continue
            race_date = _safe_date(
                r2.get("date") or r2.get("start_date") or r2.get("race_date")
            )
            races_min.append({
                "name": r2.get("name") or r2.get("title"),
                "date": race_date,
                "days_until_race": _days_until(race_date),
                "race_goal": r2.get("race_goal"),
                "race_type": r2.get("type") or r2.get("race_type"),
                "target_time": r2.get("target_time"),
                "custom_distance_km": r2.get("custom_distance_km"),
                "elevation_gain_m": r2.get("elevation_gain_m"),
                "terrain": r2.get("terrain"),
                "priority": r2.get("priority"),
            })
            if len(races_min) >= 10:
                break

    prefs2: Dict[str, Any] = {
        "main_sport": raw_prefs.get("main_sport"),
        "add_on_sports": raw_prefs.get("add_on_sports"),
        "included_sports": raw_prefs.get("included_sports"),
        "goal_kind": raw_prefs.get("goal_kind"),
        "volume": {
            "mode": volume.get("mode"),
            "value": volume.get("value"),
        } if volume else {},
        "preferences": {
            "days_off": preferences.get("days_off"),
            "long_run_days": preferences.get("long_run_days"),
            "avoid_two_a_day": preferences.get("avoid_two_a_day"),
            "avoid_back_to_back_hard": preferences.get("avoid_back_to_back_hard"),
            "womens_health": preferences.get("womens_health"),
        } if preferences else {},
        "targets": {
            "run": {
                "race_goal": run_t.get("race_goal"),
                "race_type": run_t.get("race_type"),
                "target_time": run_t.get("target_time"),
                "races": races_min,
            } if run_t else {},
            "strength": {
                "focus": strength_t.get("focus"),
                "sessions_per_week": strength_t.get("sessions_per_week"),
            } if strength_t else {},
        } if targets else {},
    }

    # Strength settings explicitne — sessions_per_week je kľúčové pre plánovanie
    if strength_sessions:
        prefs2["strength_sessions_per_week"] = strength_sessions

    # Weekly template — len key sloty
    wt = _as_dict(raw_prefs.get("weekly_template"))
    if wt:
        prefs2["weekly_template"] = {
            "mode": wt.get("mode"),
            "fixed_slots": _derive_key_slots_from_weekly_template(wt),
        }

    ctx2["prefs"] = prefs2

    # Athlete state — bez metrics a bez plan_adjustment
    athlete_state = _as_dict(context.get("athlete_state"))
    is_beginner = athlete_state.get("is_returning_beginner")
    if athlete_state:
        ai_state = dict(_as_dict(athlete_state.get("ai_state")))
        ai_state.pop("metrics", None)
        ai_state.pop("plan_adjustment", None)
        ctx2["athlete_state"] = {
            "ai_state": ai_state,
            "is_returning_beginner": is_beginner,
        }

    # External events — len ak má reálne eventy
    ext = _as_dict(context.get("external_events"))
    if ext:
        events: List[Dict[str, Any]] = []
        if isinstance(ext.get("events"), list):
            events = [_as_dict(e) for e in ext["events"] if isinstance(e, dict)]
        else:
            win = _as_dict(ext.get("window"))
            if isinstance(win.get("events"), list):
                events = [_as_dict(e) for e in win["events"] if isinstance(e, dict)]

        if events:
            cleaned_events: List[Dict[str, Any]] = []
            for e in events:
                dt = (
                    e.get("occurrence_date")
                    or e.get("date")
                    or e.get("start_date_local")
                    or e.get("start_date")
                    or e.get("start_date_iso")
                )
                dt_ymd = _safe_date(dt)
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

            win2 = _as_dict(ext.get("window"))
            if win2:
                ctx2["external_events"] = {
                    "window": {
                        "from": _safe_date(win2.get("from")),
                        "to": _safe_date(win2.get("to")),
                        "events": cleaned_events,
                    }
                }
            else:
                ctx2["external_events"] = {"events": cleaned_events}

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

    # Meta polia
    for k in ("weeks", "replan_trigger", "generate_reason", "target_end_date"):
        if k in context:
            ctx2[k] = context[k]

    return _remove_empty(ctx2)


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def build_prompts_for_weekly(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre weekly meta-plán.
    """
    settings = _as_dict(settings or {})
    lang_label, second_person_note = _lang_notes(settings)

    ctx = _as_dict(context_payload)
    raw_prefs = _extract_prefs_source(ctx)
    preferences_obj = _get_dict(raw_prefs, "preferences")

    weeks = int(raw_prefs.get("weeks") or ctx.get("weeks") or 6)
    start_date = _safe_date(
        raw_prefs.get("start_date")
        or raw_prefs.get("plan_start_date")
        or _get_dict(ctx.get("plan_meta") or {}, "").get("start_date")
    )
    main_sport = raw_prefs.get("main_sport") or "run"

    # Zoznam povolených sportov
    sports_set = {main_sport}
    add_on = raw_prefs.get("add_on_sports")
    included = raw_prefs.get("included_sports")
    if isinstance(add_on, list):
        sports_set.update(s.lower() for s in add_on if isinstance(s, str) and s)
    elif isinstance(included, list):
        sports_set.update(s.lower() for s in included if isinstance(s, str) and s)

    # Strength
    strength_settings = _get_dict(raw_prefs, "strength_settings")
    strength_sessions = None
    try:
        raw = strength_settings.get("sessions_per_week")
        if raw:
            strength_sessions = int(raw)
            if strength_sessions > 0:
                sports_set.add("strength")
    except Exception:
        pass

    final_sports_list = list(sports_set)

    # Athlete state
    athlete_state = _as_dict(ctx.get("athlete_state"))
    is_returning_beginner = bool(athlete_state.get("is_returning_beginner"))

    # Nearest race hint
    targets = _get_dict(raw_prefs, "targets")
    run_races = _as_list(_get_dict(targets, "run").get("races"))
    next_race = min(
        (r for r in run_races
         if isinstance(r, dict) and isinstance(r.get("days_until_race"), int) and r["days_until_race"] >= 0),
        key=lambda r: r["days_until_race"],
        default=None,
    )
    race_hint = ""
    if next_race:
        dist = next_race.get("custom_distance_km")
        elev = next_race.get("elevation_gain_m")
        terrain = next_race.get("terrain")
        details_parts = []
        if dist:
            details_parts.append(f"{dist} km")
        if elev:
            details_parts.append(f"{elev}m elev")
        if terrain:
            details_parts.append(f"{terrain} terrain")
        details = f" ({', '.join(details_parts)})" if details_parts else ""

        # Python-vypočítaný presný deň v týždni (LLM si to nesmie počítať samo).
        race_date_str = _safe_date(next_race.get("date"))
        weekday_str = ""
        if race_date_str:
            try:
                race_weekday = date.fromisoformat(race_date_str).strftime("%A")
                weekday_str = f" — {race_weekday} (calculated by system, do not recompute)"
            except Exception:
                pass

        race_hint = (
            f"\n- KEY RACE: {next_race.get('name')} on {race_date_str or 'unknown date'}{weekday_str}, "
            f"in {next_race.get('days_until_race')} days{details}."
            f" Target: {next_race.get('target_time')}. "
            "Build taper 2-3 weeks before. Adjust periodization accordingly.\n"
        )

    # Minifikovaný context pre AI
    context_for_ai = minify_weekly_context_for_ai(ctx)
    prefs_min = _as_dict(context_for_ai.get("prefs"))
    vol = _get_dict(prefs_min, "volume")
    volume_mode = vol.get("mode")
    volume_value = vol.get("value")

    # Women's health
    womens_health_rule = _build_womens_health_rule(preferences_obj, start_date)

    # Volume hints
    volume_hint_lines: List[str] = []
    if is_returning_beginner:
        volume_hint_lines.append(
            "- ATHLETE IS A BEGINNER (LEVEL 1): Start VERY light (40-90 min total/week). "
            "Focus on bone and tendon adaptation."
        )
    if volume_mode == "weekly_hours" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            f"- Baseline target: {volume_value * 60:.0f} total minutes per week."
        )
    elif volume_mode == "daily_minutes" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(f"- Baseline target: ~{volume_value} min per active day.")
    else:
        volume_hint_lines.append("- No volume target: use ai_state.volume_tolerance.")
    volume_hint_lines.append("- Stay within ai_state.volume_tolerance min/max.")
    volume_hint_lines.append("- Use 2-3 build weeks + 1 recovery week cycle.")
    if strength_sessions:
        volume_hint_lines.append(
            f"- STRENGTH: Include {strength_sessions}x strength sessions per week in planned_stats."
        )
    volume_hint = "\n".join(volume_hint_lines)

    # Beginner protokol
    beginner_protocol = (
        "\n- BEGINNER COACHING PROTOCOL:\n"
        "  - Tone: Encouraging, educational, protective.\n"
        "  - 'notes' MUST explain the theme. Remind 'Easy means Easy' (Talk Test).\n"
        "  - Emphasize that walking during a run is success, not failure.\n"
        if is_returning_beginner else ""
    )

    # Špeciálny dôvod
    reason = context_for_ai.get("generate_reason")
    special_reason_rule = ""
    if reason == "health_resolved_return":
        special_reason_rule = (
            "\n--- HEALTH RECOVERY (RETURN TO PLAY) ---\n"
            "- Athlete just recovered from illness/injury.\n"
            "- Week 1 MUST be very low volume and Z1/Z2 only.\n"
            "- No high-intensity intervals in the first week.\n"
        )
    elif reason == "health_recovery_mild":
        special_reason_rule = (
            "\n--- MILD HEALTH RESTRICTION ---\n"
            "- Athlete is not 100% fit yet.\n"
            "- Week 1 MUST be ultra-light with extra rest days.\n"
        )

    # Athlete notes — sticky (každý plán) + ephemeral (len tento plán)
    coach_notes = _as_dict(ctx.get("coach_notes"))
    sticky_notes = coach_notes.get("sticky_notes") or []
    ephemeral_note = coach_notes.get("ephemeral_note")

    notes_rule = ""
    if sticky_notes or ephemeral_note:
        lines = [
            "--- ATHLETE INSTRUCTIONS (CRITICAL — MUST FOLLOW) ---",
            "The athlete has left direct instructions. Respect them throughout the entire plan.\n",
        ]
        if sticky_notes:
            lines.append("Permanent (applies to every plan):")
            for i, n in enumerate(sticky_notes, 1):
                lines.append(f"  {i}. {n}")
        if ephemeral_note:
            lines.append(f"\nOne-time instruction for THIS plan only:\n  → {ephemeral_note}")
        lines.append(
            "\nCRITICAL: You MUST fill 'coach_reply' in your output — 2-3 sentences "
            "directly addressing this note. Explicitly say what you changed because of "
            "it, OR if you deliberately did NOT do what they asked (e.g. because of "
            "taper/periodization/race timing), say so clearly and explain what you did "
            "instead. The athlete needs to know whether their request was applied or not "
            "— do not leave this ambiguous."
        )
        notes_rule = "\n".join(lines) + "\n\n"

    sports_restriction = (
        f"- ALLOWED SPORTS: {', '.join(final_sports_list)}.\n"
        "- ONLY populate planned_stats for listed sports. Set others to 0."
    )

    week_boundaries = ctx.get("week_boundaries") or []
    is_replan = bool(ctx.get("is_replan"))
    past_weeks_summary = ctx.get("past_weeks_summary") or []
    target_end_date = ctx.get("target_end_date")

    system_txt = (
        "You are an elite endurance coaching assistant. "
        "Your task is to design a high-level WEEKLY meta training plan. "
        "Return ONE valid JSON object only. Do NOT output prose or markdown."
    )

    user_txt = (
        f"Design a WEEKLY meta plan.\n"
        f"Main sport: {main_sport}\n"
        f"Horizon: {weeks} weeks starting {start_date or 'ASAP'}.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA & REQUIREMENTS:\n"
        + _weekly_schema() + "\n"
        + f"- All text fields (goal, notes) must be in {lang_label}. {second_person_note}\n"
        + sports_restriction + "\n"
        + "- Volume guidelines:\n"
        + volume_hint
        + _week_boundaries_rule(week_boundaries, is_replan)
        + _target_end_date_rule(target_end_date, week_boundaries)
        + _past_weeks_summary_rule(past_weeks_summary)
        + race_hint
        + beginner_protocol
        + special_reason_rule
        + womens_health_rule
        + notes_rule
        + _time_format_rule()
    )

    return system_txt, user_txt


# ============================================================
# SCHEMA
# ============================================================

def _weekly_schema() -> str:
    """JSON schéma pre weekly meta-plán."""
    return """
{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp",
  "coach_reply": "string | null — ONLY if the athlete left a note (ephemeral_note or sticky_notes): 2-3 sentences DIRECTLY addressing what they asked. Explicitly confirm what you changed because of it, OR explain why you did NOT make that specific change (e.g. periodization/taper reasons) and what you did instead. If no athlete note was provided, set this to null.",
  "weeks": [
    {
      "week_index": number,
      "week_start": "YYYY-MM-DD - MUST match context.week_boundaries EXACTLY for this week_index, do not calculate yourself",
      "week_end": "YYYY-MM-DD - MUST match context.week_boundaries EXACTLY for this week_index, do not calculate yourself",
      "goal": "1 punchy sentence",
      "focus": "Short technical tag",
      "load_phase": "Base Aerobic" | "Build" | "Peak" | "Recovery" | "Taper" | "Race",
      "planned_stats": {
        "run_distance_km": number,
        "run_time_min": number,
        "bike_time_min": number,
        "strength_time_min": number,
        "other_time_min": number
      },
      "notes": "string"
    }
  ]
}
""".strip()
