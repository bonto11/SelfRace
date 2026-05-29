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
    """
    Vráti špeciálnu inštrukciu pre cycle sync ak je aktivovaná a dátum sedí.
    Bug fix: abs() na days_into_cycle aby nebol záporný pri plan_start < cycle_start.
    """
    womens_health = _get_dict(preferences_obj, "womens_health")
    if not womens_health.get("sync_enabled"):
        return ""

    next_cycle_start_str = womens_health.get("next_cycle_start")
    if not next_cycle_start_str:
        return ""

    try:
        cycle_length = int(womens_health.get("cycle_length_days") or 28)
        plan_start_dt = (
            date.fromisoformat(start_date) if start_date else date.today()
        )
        cycle_start_dt = date.fromisoformat(next_cycle_start_str[:10])

        # abs() zaručí správny výsledok aj keď plan_start je pred cycle_start
        diff_days = (plan_start_dt - cycle_start_dt).days
        days_into_cycle = abs(diff_days) % cycle_length

        if 0 <= days_into_cycle <= 7:
            return (
                "\n--- WOMEN'S HEALTH (CYCLE SYNC) ---\n"
                "- The athlete's menstrual cycle starts this week.\n"
                "- You MUST respect her physiology. Make this week a TAPER / RECOVERY week.\n"
                "- Lower the total volume by 20-30%, prioritize Z1/Z2, avoid max intensity intervals.\n"
                "- Remind her gently in the 'notes' that this is an expected lighter week.\n"
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
    Zachováva: prefs (s races, weekly_template), athlete_state (bez metrics),
    external_events, weeks, replan_trigger, generate_reason.
    """
    context = _as_dict(context)
    ctx2: Dict[str, Any] = {}

    raw_prefs = _extract_prefs_source(context)
    preferences = _get_dict(raw_prefs, "preferences")
    volume = _get_dict(raw_prefs, "volume")
    targets = _get_dict(raw_prefs, "targets")
    run_t = _get_dict(targets, "run")
    strength_t = _get_dict(targets, "strength")

    # Races — minifikované
    races_raw = run_t.get("races")
    races_min: Optional[List[Dict[str, Any]]] = None
    if isinstance(races_raw, list):
        races_min = []
        for r in races_raw:
            r2 = _as_dict(r)
            if not r2:
                continue
            races_min.append({
                "date": _safe_date(
                    r2.get("date") or r2.get("start_date") or r2.get("race_date")
                ),
                "name": r2.get("name") or r2.get("title"),
                "type": r2.get("type") or r2.get("race_type"),
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

    # Weekly template — len key sloty
    wt = _as_dict(raw_prefs.get("weekly_template"))
    if wt:
        prefs2["weekly_template"] = {
            "mode": wt.get("mode"),
            "fixed_slots": _derive_key_slots_from_weekly_template(wt),
        }

    ctx2["prefs"] = prefs2

    # Athlete state — bez metrics (tie sú inde)
    athlete_state = _as_dict(context.get("athlete_state"))
    is_beginner = athlete_state.get("is_returning_beginner")
    if athlete_state:
        ai_state = dict(_as_dict(athlete_state.get("ai_state")))
        ai_state.pop("metrics", None)
        ctx2["athlete_state"] = {
            "ai_state": ai_state,
            "is_returning_beginner": is_beginner,
        }

    # External events
    ext = _as_dict(context.get("external_events"))
    if ext:
        events: List[Dict[str, Any]] = []
        if isinstance(ext.get("events"), list):
            events = [_as_dict(e) for e in ext["events"] if isinstance(e, dict)]
        else:
            win = _as_dict(ext.get("window"))
            if isinstance(win.get("events"), list):
                events = [_as_dict(e) for e in win["events"] if isinstance(e, dict)]

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

    # Meta polia
    for k in ("weeks", "replan_trigger", "generate_reason"):
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
    Detekuje volume mode, beginner stav, women's health cycle, špeciálne dôvody.
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
    final_sports_list = list(sports_set)

    # Athlete state
    athlete_state = _as_dict(ctx.get("athlete_state"))
    is_returning_beginner = bool(athlete_state.get("is_returning_beginner"))

    # Minifikovaný context pre AI
    context_for_ai = minify_weekly_context_for_ai(ctx)
    prefs_min = _as_dict(context_for_ai.get("prefs"))
    vol = _get_dict(prefs_min, "volume")
    volume_mode = vol.get("mode")
    volume_value = vol.get("value")

    # Women's health rule — opravený bug (abs() na diff_days)
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
        volume_hint_lines.append(
            f"- Baseline target: ~{volume_value} min per active day."
        )
    else:
        volume_hint_lines.append("- No volume target: use ai_state.volume_tolerance.")
    volume_hint_lines.append("- Stay within ai_state.volume_tolerance min/max.")
    volume_hint_lines.append("- Use 2-3 build weeks + 1 recovery week cycle.")
    volume_hint = "\n".join(volume_hint_lines)

    # Beginner protokol
    beginner_protocol = (
        "\n- BEGINNER COACHING PROTOCOL:\n"
        "  - Tone: Encouraging, educational, protective.\n"
        "  - 'notes' MUST explain the theme. Remind 'Easy means Easy' (Talk Test).\n"
        "  - Emphasize that walking during a run is success, not failure.\n"
        if is_returning_beginner
        else ""
    )

    # Špeciálny dôvod generovania
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

    sports_restriction = (
        f"- ALLOWED SPORTS: {', '.join(final_sports_list)}.\n"
        "- ONLY populate planned_stats for listed sports. Set others to 0."
    )

    system_txt = (
        "You are an elite endurance coaching assistant. "
        "Your task is to design a high-level WEEKLY meta training plan. "
        "Return ONE valid JSON object only. Do NOT output prose or markdown."
    )

    schema_text = _weekly_schema()

    user_txt = (
        f"Design a WEEKLY meta plan.\n"
        f"Main sport: {main_sport}\n"
        f"Horizon: {weeks} weeks starting {start_date or 'ASAP'}.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA & REQUIREMENTS:\n"
        + schema_text + "\n"
        + f"- All text fields (goal, notes) must be in {lang_label}. {second_person_note}\n"
        + sports_restriction + "\n"
        + "- Volume guidelines:\n"
        + volume_hint
        + beginner_protocol
        + special_reason_rule
        + womens_health_rule
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
  "weeks": [
    {
      "week_index": number,
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
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