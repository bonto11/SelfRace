# ===== Routes_AI/daily_plan_prompts.py =====
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

# -----------------------------------------------------------------------------
# DEBUG (env controlled)
# -----------------------------------------------------------------------------
# Zapneš na Railway env varom:
#   DAILY_DEBUG=1
_DEBUG_ENABLED = str(os.getenv("DAILY_DEBUG") or "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _dprint(*parts: Any) -> None:
    if not _DEBUG_ENABLED:
        return
    try:
        msg = " ".join(str(p) for p in parts)
        print(f"[DAILY_PROMPTS] {msg}")
    except Exception:
        pass


WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}


def _safe_int(v: Any, default: int, *, min_v: Optional[int] = None, max_v: Optional[int] = None) -> int:
    try:
        if v is None:
            out = default
        elif isinstance(v, bool):
            out = int(v)
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


def _minify_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send only what the LLM truly needs (new approach):
      - week meta
      - recent_load, zones, thresholds
      - prefs (minified)
      - athlete_state.ai_state (optional)
      - external_events occurrences (HARD constraint)
      - planning_constraints (two-a-day cap, long_run_days, etc.)
    """
    ctx2: Dict[str, Any] = {}

    for k in ("week", "zones", "thresholds", "recent_load", "external_events", "planning_constraints"):
        if k in ctx:
            ctx2[k] = ctx[k]

    raw_prefs = ctx.get("prefs") or {}
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    # Keep prefs lean + aligned with new schema direction
    prefs2: Dict[str, Any] = {
        "schema_version": prefs.get("schema_version"),
        "main_sport": prefs.get("main_sport"),
        "addons": prefs.get("addons"),
        "start_date": prefs.get("start_date"),
        "volume": prefs.get("volume"),
        "preferences": prefs.get("preferences") or {},
        "strength_settings": prefs.get("strength_settings") or {},
        "targets": prefs.get("targets") or {},
    }

    ctx2["prefs"] = prefs2

    athlete_state = ctx.get("athlete_state") or {}
    ai_state = athlete_state.get("ai_state") or {}
    ctx2["athlete_state"] = {"ai_state": ai_state}

    for k in ("last_activities", "user_settings"):
        if k in ctx:
            ctx2[k] = ctx[k]

    # Debug summary (do NOT print full JSON)
    try:
        wk = ctx2.get("week") or {}
        ext = ctx2.get("external_events") or {}
        ext_n = len(ext.get("occurrences") or []) if isinstance(ext, dict) else 0
        pc = ctx2.get("planning_constraints") or {}
        _dprint(
            "_minify_context_for_ai:",
            "week_start=",
            wk.get("week_start"),
            "week_end=",
            wk.get("week_end"),
            "| external_occurrences=",
            ext_n,
            "| planning_constraints=",
            json.dumps(pc, ensure_ascii=False)[:220],
        )
    except Exception as e:
        _dprint("_minify_context_for_ai: debug summary failed:", repr(e))

    return ctx2


def _build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, List[Dict[str, Any]], Optional[int]]:
    """
    New contract:
      - AI plans the full week (dates + sessions).
      - It MUST include ALL external events occurrences as sessions on those dates.
      - Prefer: only 1 session/day; allow 2 sessions/day on max N days/week (cap).
      - Strength sessions count is a target, not hard-coded by us beyond the numeric requirement.
      - Long run: should happen once/week if main sport is run, and prefer given long_run_days.
      - No weekly_template, no day_constraints, no lock payload rules (server won't inject locks).
    Returns: (system_txt, user_txt, legacy_fixed_slots=[], strength_target_int)
    """
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
        second_person_note = "Vždy hovor priamo k atlétovi a používaj 2. osobu."

    week = context_payload.get("week") or {}

    raw_prefs = context_payload.get("prefs") or {}
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    targets = context_payload.get("targets") or prefs.get("targets") or {}

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    focus = week.get("focus") or ""
    load_phase = week.get("load_phase") or ""
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"

    pref_obj = prefs.get("preferences") or {}
    avoid_back_to_back_hard = bool(pref_obj.get("avoid_back_to_back_hard"))
    long_run_days = pref_obj.get("long_run_days") or []
    if not isinstance(long_run_days, list):
        long_run_days = []
    long_run_days = [str(d) for d in long_run_days if isinstance(d, str)]

    # planning_constraints are computed in builder (source of truth)
    pc = context_payload.get("planning_constraints") or {}
    if not isinstance(pc, dict):
        pc = {}
    two_a_day_cap = _safe_int(pc.get("two_a_day_max_days_per_week"), 0, min_v=0, max_v=2)

    # strength sessions target: from new place (prefs.strength_settings.sessions_per_week),
    # fallback to old targets.strength.sessions_per_week if present
    strength_settings = prefs.get("strength_settings") or {}
    if not isinstance(strength_settings, dict):
        strength_settings = {}
    strength_target_int = None
    s_target = strength_settings.get("sessions_per_week")
    if isinstance(s_target, int):
        strength_target_int = int(s_target)
    else:
        legacy = (targets.get("strength") or {}).get("sessions_per_week")
        if isinstance(legacy, int):
            strength_target_int = int(legacy)

    # external occurrences (HARD)
    ext = context_payload.get("external_events") or {}
    ext_occ = ext.get("occurrences") if isinstance(ext, dict) else None
    ext_count = len(ext_occ) if isinstance(ext_occ, list) else 0

    _dprint(
        "build_prompts:",
        "week_index=",
        week_index,
        "| range=",
        week_start,
        "..",
        week_end,
        "| main_sport=",
        main_sport,
        "| planned_minutes=",
        planned_minutes,
        "| external_occurrences=",
        ext_count,
        "| two_a_day_cap=",
        two_a_day_cap,
        "| long_run_days=",
        long_run_days,
        "| strength_target=",
        strength_target_int,
        "| avoid_b2b_hard=",
        avoid_back_to_back_hard,
    )

    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = f"{strength_target_int}× per week" if strength_target_int is not None else "not specified"

    # Volume guidance (soft)
    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode") if isinstance(volume_prefs, dict) else None
    volume_value = volume_prefs.get("value") if isinstance(volume_prefs, dict) else None

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- Weekly target from WEEK META: planned_minutes ≈ {planned_minutes} min.\n"
            "  Treat this as intent only.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = (
            "- Volume preference: prefs.volume.mode='weekly_hours'. "
            f"Target weekly volume ≈ {volume_value * 60:.0f} min.\n"
            "  Treat this as intent only.\n"
        )
    else:
        weekly_volume_line = "- Weekly volume not explicitly specified; infer from recent_load.\n"

    back_to_back_rule = (
        "- Do NOT schedule two hard sessions on consecutive days.\n"
        if avoid_back_to_back_hard
        else "- Avoid back-to-back hard days when possible.\n"
    )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week. "
        "Return ONE valid JSON object only. No prose, no code fences."
    )

    # Keep schema compatible with current FE/DB,
    # but remove legacy lock/payload constraints.
    schema_text = """
{
  "schema_version": 2,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string",
  "week_index": number,
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "sessions": [
        {
          "sport": "run" | "ride" | "strength" | "swim" | "other",
          "title": string,
          "duration_min": number,
          "intensity": string | null,
          "session_type": string | null,
          "zone_text": string | null,
          "notes": string | null,
          "structure": object | null,
          "payload"?: object | null
        }
      ]
    }
  ],
  "warnings"?: [string]
}
""".strip()

    # HARD requirements around external events
    external_rules = (
        "- EXTERNAL EVENTS (HARD REQUIREMENT):\n"
        "  In CONTEXT_JSON.external_events.occurrences you will receive date-based external events.\n"
        "  You MUST include each occurrence as a session on the SAME date.\n"
        "  Use these fields exactly:\n"
        "    - date: occurrence.date\n"
        "    - title: occurrence.title\n"
        "    - duration_min: occurrence.duration_min (if present)\n"
        "    - intensity: occurrence.intensity (if present: easy|medium|hard)\n"
        "    - sport: occurrence.session_sport (mapped for FE)\n"
        "    - session_type: 'external_event'\n"
        "    - payload.external_event must include: date, title, sport (raw), start_time_local, duration_min, priority, intensity\n"
        "  Do NOT move external events to a different day.\n"
        "\n"
    )

    two_a_day_rule = (
        "- TWO-A-DAY RULE:\n"
        f"  Prefer 1 session/day.\n"
        f"  You may schedule 2 sessions in a day on at most {two_a_day_cap} day(s) in the week.\n"
        "  If cap is 0, never schedule 2 sessions in a day.\n"
        "\n"
    )

    long_run_rule = (
        "- LONG RUN RULE:\n"
        f"  If main sport is run, schedule exactly 1 long run in the week when reasonable.\n"
        f"  Prefer weekday(s): {long_run_days_str}.\n"
        "  If not possible due to fatigue / external events, pick another suitable day and explain in notes.\n"
        "\n"
    )

    strength_rule = (
        "- STRENGTH RULE:\n"
        f"  Aim for {strength_str}.\n"
        "  Keep strength simple; server will normalize and mapper will add exercises.\n"
        "\n"
    )

    explanation_rule = (
        "- EXPLANATION RULE (MANDATORY):\n"
        "  Every session MUST include 1–2 concrete sentences in `notes`:\n"
        "    - why this session is placed on this day (spacing / fatigue / goal), OR\n"
        "    - why a preference could not be followed.\n"
        "  No fluff.\n"
        "\n"
    )

    context_for_ai = _minify_context_for_ai(context_payload)
    if settings:
        context_for_ai["user_settings"] = settings

    # If week range missing, do not invent dates
    fallback_block = ""
    if not week_start or not week_end:
        fallback_block = (
            "\nFALLBACK MODE (missing week_start/week_end):\n"
            "- You MUST NOT invent calendar dates.\n"
            "- Return days: [] and add warnings: ['missing_week_range'].\n"
        )
        _dprint("build_prompts: FALLBACK MODE active (missing week_start/week_end)")

    user_txt = (
        "Generate a full weekly training plan (calendar dates + sessions) based on the context JSON.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start or 'unknown'} .. {week_end or 'unknown'}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"External events occurrences in this week: {ext_count}\n\n"
        + external_rules
        + two_a_day_rule
        + long_run_rule
        + strength_rule
        + weekly_volume_line
        + back_to_back_rule
        + explanation_rule
        + "\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + fallback_block
        + "\n\nHard requirements:\n"
        + "- Always return a single JSON object matching the schema.\n"
        + f"- All free text MUST be written in {lang_label} and address the athlete directly in 2nd person. {second_person_note}\n"
        + "- Do NOT invent extreme workloads.\n"
        + "- Do NOT omit any external event occurrence.\n"
    )

    _dprint("prompt sizes: system_chars=", len(system_txt), "| user_chars=", len(user_txt))
    return system_txt, user_txt, [], strength_target_int