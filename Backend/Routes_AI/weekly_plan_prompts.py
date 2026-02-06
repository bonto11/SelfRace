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
    """
    Z weekly_template vyber len 'key' sloty (soft preferencie).
    Očakávaný tvar:
      wt = {"mode": "...", "days": [{"day":"Mon","slots":[{"priority":"key","sport":"run","kind":"intervals"}]}]}
    """
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
    """
    Preferuj prefs z analyze_input_min/analyze_input (to je "ground truth" z DB buildera),
    fallback na ctx["prefs"] (ktoré môže byť už prefiltrované).
    """
    analyze_src = _as_dict(context.get("analyze_input_min") or context.get("analyze_input") or {})
    prefs_any = analyze_src.get("prefs")
    if isinstance(prefs_any, dict):
        return prefs_any

    prefs_any = context.get("prefs")
    if isinstance(prefs_any, dict):
        return prefs_any

    return {}


def minify_weekly_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orezaný context pre WEEKLY LLM:
    - drop user_id / internal ids
    - keep only what weekly meta plan needs
    - recent_load/zones/thresholds/recovery berieme z TOP-LEVEL alebo z analyze_input_min/analyze_input
    - external_events podporuje oba tvary: date string aj days_from_today (z buildera)
    """
    context = _as_dict(context)
    ctx2: Dict[str, Any] = {}

    # Source of "big blocks"
    analyze_src = _as_dict(context.get("analyze_input_min") or context.get("analyze_input") or {})

    # --- prefs (flatten + trim) ---
    raw_prefs = _extract_prefs_source(context)
    prefs_val = raw_prefs.get("value")
    prefs = _as_dict(prefs_val) if isinstance(prefs_val, dict) else _as_dict(raw_prefs)

    preferences = _get_dict(prefs, "preferences")
    volume = _get_dict(prefs, "volume")
    targets = _get_dict(prefs, "targets")

    run_t = _get_dict(targets, "run")
    strength_t = _get_dict(targets, "strength")

    # races minify: keep only key fields
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

    # weekly_template: posli len key slots
    wt = _as_dict(prefs.get("weekly_template"))
    if wt:
        prefs2["weekly_template"] = {
            "mode": wt.get("mode"),
            "fixed_slots": _derive_key_slots_from_weekly_template(wt),
        }

    ctx2["prefs"] = prefs2

    # --- athlete_state (len ai_state) ---
    athlete_state = _as_dict(context.get("athlete_state"))
    if athlete_state:
        ai_state = _as_dict(athlete_state.get("ai_state"))
        ctx2["athlete_state"] = {"ai_state": ai_state}

    # --- recent_load / zones / thresholds / recovery ---
    for key in ("recent_load", "zones", "thresholds", "recovery"):
        v = context.get(key)
        if not isinstance(v, dict):
            v = analyze_src.get(key)
        if isinstance(v, dict):
            ctx2[key] = v

    # --- external_events ---
    # Podporujeme:
    #  A) ext["events"] alebo ext["window"]["events"]
    #  B) event date buď ako occurrence_date/date/start_date..., alebo ako days_from_today (int)
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
            # prefer explicit date
            dt = (
                e.get("occurrence_date")
                or e.get("date")
                or e.get("start_date_local")
                or e.get("start_date")
                or e.get("start_date_iso")
            )
            dt_ymd = _safe_date_yyyy_mm_dd(dt)

            # or relative
            dft = e.get("days_from_today")
            if dt_ymd is None and isinstance(dft, (int, float)):
                # keep relative when no date string exists
                cleaned_events.append(
                    {
                        "days_from_today": int(dft),
                        "sport": e.get("sport"),
                        "duration_min": e.get("duration_min"),
                        "priority": e.get("priority"),
                        "title": e.get("title"),
                    }
                )
                continue

            if not dt_ymd:
                continue

            cleaned_events.append(
                {
                    "occurrence_date": dt_ymd,
                    "sport": e.get("sport"),
                    "duration_min": e.get("duration_min"),
                    "priority": e.get("priority"),
                    "title": e.get("title"),
                }
            )

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

    # --- settings (minify) ---
    settings = _as_dict(context.get("user_settings"))
    if settings:
        ctx2["user_settings"] = {
            "language": settings.get("language"),
            "timezone": settings.get("timezone"),
        }

    # --- meta ---
    if "weeks" in context:
        ctx2["weeks"] = context.get("weeks")
    if "overwrite" in context:
        ctx2["overwrite"] = bool(context.get("overwrite"))

    return ctx2


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

    # ✅ preferuj analyze_input_min (z buildera), fallback na analyze_input
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

    # attach settings safely
    safe_settings = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }
    ctx2 = dict(ctx)
    ctx2["user_settings"] = safe_settings

    # ✅ MINIFY HERE
    context_for_ai = minify_weekly_context_for_ai(ctx2)

    # derive volume hint from MINIFIED prefs
    prefs_min = _as_dict(context_for_ai.get("prefs"))
    vol = _get_dict(prefs_min, "volume")
    volume_mode = vol.get("mode")
    volume_value = vol.get("value")

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON with athlete preferences (including volume preferences), "
        "AI analysis state, recent load, thresholds, zones, recovery and external events. "
        "External events are fixed activities like football matches, club runs or other regular trainings, "
        "which already create load and must be counted into total weekly volume or at least reduce the room for training. "
        "The AI analysis (athlete_state.ai_state) also includes a plan_adjustment block that can suggest "
        "short-term softening of load or a need to re-plan the weekly structure. "
        "Your task is to design a WEEK-BY-WEEK meta training plan (no daily sessions yet). "
        "You must return ONE valid JSON object only. No prose, no code fences."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name)",
  "plan_meta": {{
    "start_date": "YYYY-MM-DD" | null,
    "weeks": number,
    "main_sport": string,
    "goal_kind": string | null
  }},
  "weeks": [
    {{
      "week_index": number,
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "goal": string | null,
      "focus": string | null,
      "load_phase": string | null,
      "planned_km": number | null,
      "planned_minutes": number | null,
      "notes": string | null
    }}
  ]
}}
""".strip()

    volume_hint_lines: List[str] = []

    if volume_mode == "weekly_hours" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            "- In prefs.volume the athlete has a target as weekly_hours. "
            "Convert this to minutes (hours * 60) and treat it as the baseline weekly volume target."
        )
    elif volume_mode == "daily_minutes" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            "- In prefs.volume the athlete has a target as daily_minutes. "
            "Approximate training_days from prefs.preferences.days_off: training_days ≈ 7 - count(days_off). "
            "Baseline weekly volume ≈ daily_minutes * training_days."
        )
    else:
        volume_hint_lines.append(
            "- prefs.volume.value is null or missing, so estimate the target volume "
            "from recent_load, recovery and ai_state.volume_tolerance. Be conservative."
        )

    volume_hint_lines.append(
        "- In athlete_state.ai_state.volume_tolerance you have weekly_minutes_min and weekly_minutes_max. "
        "Keep planned_minutes mostly inside this range. Short deviations are OK but not extreme."
    )
    volume_hint_lines.append(
        "- external_events contains external sports and life events. Sports-type events count as training load. "
        "Non-sport big events reduce available time and should lower planned_minutes."
    )
    volume_hint_lines.append(
        "- Use recent_load and recovery to shape progression (e.g. 2–3 build weeks + 1 recovery week), "
        "without chronically exceeding weekly_minutes_max."
    )

    volume_hint = "\n".join(volume_hint_lines)

    user_txt = (
        "You will design a WEEKLY meta training plan for the athlete.\n"
        f"Main sport: {main_sport}\n"
        f"Goal kind: {goal_kind}\n"
        f"Planning horizon (weeks): {weeks}\n"
        f"Preferred plan start date (if any): {start_date or 'none'}\n"
        f"Target athlete language for all text fields: {lang_label}.\n\n"
        "CONTEXT_JSON (ground truth – use it as the only source of information):\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema (you may set numeric fields to null if unknown).\n"
        f"- All free text fields (goal, focus, notes) MUST be written in {lang_label} and MUST speak directly to the athlete in 2nd person. "
        f"{second_person_note} Never refer to them as 'the athlete', 'he', 'she' or similar.\n"
        "- Make sure week_index starts at 1 and increases consecutively (1, 2, 3, ...).\n"
        "- week_start and week_end must be valid dates and form continuous, non-overlapping weeks.\n"
        "- Use athlete_state.ai_state (fitness, fatigue, injury risk, volume_tolerance, intensity_tolerance, plan_adjustment)\n"
        "  to assign load_phase and decide load progression.\n"
        "- Do NOT generate daily sessions here – only weekly meta.\n"
        "- planned_minutes must include meaningful sports-type external events; reduce for big non-sport events.\n"
        "- Volume guidelines:\n"
        + volume_hint
        + "\n"
        "- If fatigue_level='high' or injury_risk='high', make week 1 a clear recovery week near weekly_minutes_min.\n"
        "- If plan_adjustment.soften_next_days.should_soften is true, ensure week 1 (optionally week 2) is visibly lighter.\n"
        "- If plan_adjustment.should_replan_weekly is true, design a structurally improved plan for the whole horizon.\n"
        "- Do NOT plan a long-term trend where most weeks are far above weekly_minutes_max.\n"
    )

    return system_txt, user_txt