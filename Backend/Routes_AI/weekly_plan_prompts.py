# Routes_AI/weekly_plan_prompts.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple
from Modules.Supabase.auth import AuthCtx


def _as_dict(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _as_list(v: Any) -> List[Any]:
    return v if isinstance(v, list) else []


def _get_dict(d: Dict[str, Any], key: str) -> Dict[str, Any]:
    return _as_dict(d.get(key))


def _safe_date_yyyy_mm_dd(v: Any) -> Optional[str]:
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:10]


def _derive_key_slots_from_weekly_template(
    wt: Dict[str, Any],
    max_fixed: int = 10,
) -> List[Dict[str, Any]]:
    wt = _as_dict(wt)
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


def _extract_prefs_source(context: Dict[str, Any]) -> Dict[str, Any]:
    analyze_src = _as_dict(context.get("analyze_input_min") or context.get("analyze_input") or {})
    prefs_any = analyze_src.get("prefs")
    if isinstance(prefs_any, dict):
        return prefs_any

    prefs_any = context.get("prefs")
    if isinstance(prefs_any, dict):
        return prefs_any

    return {}


def _remove_empty(d: Any) -> Any:
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def minify_weekly_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    context = _as_dict(context)
    ctx2: Dict[str, Any] = {}

    # --- prefs (flatten + trim) ---
    raw_prefs = _extract_prefs_source(context)
    prefs_val = raw_prefs.get("value")
    prefs = _as_dict(prefs_val) if isinstance(prefs_val, dict) else _as_dict(raw_prefs)

    preferences = _get_dict(prefs, "preferences")
    volume = _get_dict(prefs, "volume")
    targets = _get_dict(prefs, "targets")

    run_t = _get_dict(targets, "run")
    strength_t = _get_dict(targets, "strength")

    races_raw = run_t.get("races")
    races_min: Optional[List[Dict[str, Any]]] = None
    if isinstance(races_raw, list):
        races_min = []
        for r in races_raw:
            r2 = _as_dict(r)
            if not r2:
                continue
            races_min.append(
                {
                    "date": _safe_date_yyyy_mm_dd(
                        r2.get("date") or r2.get("start_date") or r2.get("race_date")
                    ),
                    "name": r2.get("name") or r2.get("title"),
                    "type": r2.get("type") or r2.get("race_type"),
                }
            )
            if len(races_min) >= 10:
                break

    prefs2: Dict[str, Any] = {
        "main_sport": prefs.get("main_sport"),
        "add_on_sports": prefs.get("add_on_sports"),
        "included_sports": prefs.get("included_sports"),
        "weeks": prefs.get("weeks"),
        "start_date": _safe_date_yyyy_mm_dd(prefs.get("start_date") or prefs.get("plan_start_date")),
        "goal_kind": prefs.get("goal_kind"),
        "volume": {"mode": volume.get("mode"), "value": volume.get("value")} if volume else {},
        "preferences": {
            "days_off": preferences.get("days_off"),
            "long_run_days": preferences.get("long_run_days"),
            "avoid_two_a_day": preferences.get("avoid_two_a_day"),
            "avoid_back_to_back_hard": preferences.get("avoid_back_to_back_hard"),
        }
        if preferences
        else {},
        "targets": {
            "run": {
                "race_goal": run_t.get("race_goal"),
                "race_type": run_t.get("race_type"),
                "target_time": run_t.get("target_time"),
                "races": races_min,
            }
            if run_t
            else {},
            "strength": {
                "focus": strength_t.get("focus"),
                "sessions_per_week": strength_t.get("sessions_per_week"),
            }
            if strength_t
            else {},
        }
        if targets
        else {},
    }

    wt = _as_dict(prefs.get("weekly_template"))
    if wt:
        prefs2["weekly_template"] = {
            "mode": wt.get("mode"),
            "fixed_slots": _derive_key_slots_from_weekly_template(wt),
        }

    ctx2["prefs"] = prefs2

    athlete_state = _as_dict(context.get("athlete_state"))
    is_beginner = athlete_state.get("is_returning_beginner")

    if athlete_state:
        ai_state = _as_dict(athlete_state.get("ai_state"))
        ai_state.pop("metrics", None)
        ctx2["athlete_state"] = {
            "ai_state": ai_state,
            "is_returning_beginner": is_beginner
        }

    ext = _as_dict(context.get("external_events"))
    if ext:
        events: List[Dict[str, Any]] = []

        if isinstance(ext.get("events"), list):
            events = [_as_dict(e) for e in ext.get("events", []) if isinstance(e, dict)]
        else:
            win = _as_dict(ext.get("window"))
            if isinstance(win.get("events"), list):
                events = [_as_dict(e) for e in win.get("events", []) if isinstance(e, dict)]

        cleaned_events: List[Dict[str, Any]] = []
        for e in events:
            dt = (
                e.get("occurrence_date")
                or e.get("date")
                or e.get("start_date_local")
                or e.get("start_date")
                or e.get("start_date_iso")
            )
            dt_ymd = _safe_date_yyyy_mm_dd(dt)

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
                    "from": _safe_date_yyyy_mm_dd(win2.get("from")),
                    "to": _safe_date_yyyy_mm_dd(win2.get("to")),
                    "events": cleaned_events,
                }
            }
        else:
            ctx2["external_events"] = {"events": cleaned_events}

    settings = _as_dict(context.get("user_settings"))
    if settings:
        ctx2["user_settings"] = {
            "language": settings.get("language"),
            "timezone": settings.get("timezone"),
        }

    if "weeks" in context:
        ctx2["weeks"] = context.get("weeks")
    if "overwrite" in context:
        ctx2["overwrite"] = bool(context.get("overwrite"))
    if "replan_trigger" in context:
        ctx2["replan_trigger"] = context.get("replan_trigger")

    return _remove_empty(ctx2)


def build_prompts_for_weekly(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    settings = _as_dict(settings or {})
    lang_code = str(settings.get("language") or "sk").lower()

    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = "Use 'you' to talk directly to the athlete."
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    else:
        lang_label = "Slovak"
        second_person_note = "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."

    ctx = _as_dict(context_payload)
    analyze_input = _as_dict(ctx.get("analyze_input_min") or ctx.get("analyze_input") or {})

    raw_prefs = _as_dict(analyze_input.get("prefs") or ctx.get("prefs") or {})
    prefs_val = raw_prefs.get("value")
    prefs = _as_dict(prefs_val) if isinstance(prefs_val, dict) else raw_prefs

    weeks = int(prefs.get("weeks") or ctx.get("weeks") or 6)
    start_date = _safe_date_yyyy_mm_dd(
        prefs.get("start_date")
        or prefs.get("plan_start_date")
        or _as_dict(ctx.get("plan_meta")).get("start_date")
        or ""
    )
    main_sport = prefs.get("main_sport") or "run"
    goal_kind = prefs.get("goal_kind") or "improve_overall"

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

    athlete_state = _as_dict(ctx.get("athlete_state"))
    is_returning_beginner = bool(athlete_state.get("is_returning_beginner"))

    safe_settings = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }
    ctx2 = dict(ctx)
    ctx2["user_settings"] = safe_settings

    context_for_ai = minify_weekly_context_for_ai(ctx2)

    prefs_min = _as_dict(context_for_ai.get("prefs"))
    vol = _get_dict(prefs_min, "volume")
    volume_mode = vol.get("mode")
    volume_value = vol.get("value")

    system_txt = (
        "You are an endurance coaching assistant. "
        "Your goal is to design a high-level WEEKLY meta training plan. "
        "Return ONE valid JSON object only."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp",
  "weeks": [
    {{
      "week_index": number,
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "goal": string (Focus of the week in human language),
      "focus": string (Short technical tag or secondary focus),
      "load_phase": "Base Aerobic" | "Build" | "Peak" | "Recovery" | etc,
      "planned_km": number | null,
      "planned_minutes": number | null,
      "notes": string (Detailed coaching advice for the week)
    }}
  ]
}}
""".strip()

    volume_hint_lines: List[str] = []
    
    # ✅ BEGINNER VOLUME RULE
    if is_returning_beginner:
        volume_hint_lines.append(
            "- ATHLETE IS A BEGINNER (LEVEL 1): Start VERY light (e.g. 40-90 min total/week). "
            "Focus on adaptation of bones and tendons, not fitness. "
            "Planned minutes must reflect a safe, low-impact return."
        )

    if volume_mode == "weekly_hours" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(f"- Baseline target: {volume_value * 60} minutes per week.")
    elif volume_mode == "daily_minutes" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(f"- Baseline target: Roughly {volume_value} min per active day.")
    else:
        volume_hint_lines.append("- No volume target specified: use ai_state.volume_tolerance.")

    volume_hint_lines.append("- athlete_state.ai_state.volume_tolerance is your safety guard. Stay mostly within min/max.")
    volume_hint_lines.append("- Use 2-3 build weeks + 1 recovery week cycle.")

    volume_hint = "\n".join(volume_hint_lines)
    
    # ✅ BEGINNER META PROTOCOL (Tone and Content)
    beginner_protocol = ""
    if is_returning_beginner:
        beginner_protocol = (
            "- BEGINNER COACHING PROTOCOL (META-LEVEL):\n"
            "  - Tone: Encouraging, educational, protective.\n"
            "  - 'goal' and 'focus' fields: Use descriptive titles like 'Building consistency' or 'Joint adaptation' instead of just 'Base'.\n"
            "  - 'notes' field: Every week MUST explain the theme. Remind the athlete that 'Easy means Easy'.\n"
            "  - Mention the 'Talk Test' or 'Sing Test' as the primary way to measure intensity this week.\n"
            "  - Emphasize that walking during a run is a success, not a failure.\n\n"
        )

    multi_sport_hint = ""
    if len(final_sports_list) > 1:
        multi_sport_hint = f"- MULTI-SPORT: {', '.join(final_sports_list)}. planned_minutes includes ALL sports."

    user_txt = (
        "Design a WEEKLY meta plan.\n"
        f"Main sport: {main_sport}\n"
        f"Sports involved: {', '.join(final_sports_list)}\n"
        f"Horizon: {weeks} weeks starting {start_date or 'ASAP'}.\n"
        f"Language: {lang_label}.\n\n"
        + beginner_protocol
        + "CONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA & REQUIREMENTS:\n"
        + schema_text
        + "\n"
        + f"- All text fields (goal, notes) must be in {lang_label} and use 2nd person ('you'). {second_person_note}\n"
        + "- week_index starts at 1.\n"
        + multi_sport_hint + "\n"
        + "- Volume guidelines:\n"
        + volume_hint
        + "\n- If recovery/fatigue is poor, start with a light week.\n"
    )

    return system_txt, user_txt