# Routes_AI/daily_plan_prompts.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

def _safe_int(
    v: Any, default: int = 0, *, min_v: Optional[int] = None, max_v: Optional[int] = None
) -> int:
    try:
        if v is None: out = default
        elif isinstance(v, bool): out = int(v)
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
    """Rekurzívne vymaže None, [], {} pre extrémnu úsporu AI tokenov."""
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
    if not isinstance(pref_obj, dict):
        pref_obj = {}

    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"

    tb = pref_obj.get("training_blocks") or {}
    if not isinstance(tb, dict): tb = {}
    training_blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    # ✅ PRIDANÉ: included_sports pre multi-sport podporu
    context2["prefs"] = {
        "weeks": prefs.get("weeks"),
        "main_sport": prefs.get("main_sport"),
        "included_sports": prefs.get("included_sports"),  # <--- TU TO PRIDÁVAME
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
    ai_state = athlete_state.get("ai_state") or {}
    if isinstance(ai_state, dict):
        ai_state_clean = dict(ai_state)
        ai_state_clean.pop("metrics", None)
        context2["athlete_state"] = {"ai_state": ai_state_clean}

    us = context.get("user_settings") or {}
    if isinstance(us, dict):
        context2["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }

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
        second_person_note = "Vždy hovor priamo k atlétovi a používaj 2. osobu."

    week = context_payload.get("week") or {}
    prefs = _flatten_prefs(context_payload.get("prefs") or {})
    targets = context_payload.get("targets") or prefs.get("targets") or {}

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    focus = week.get("focus") or ""
    load_phase = week.get("load_phase") or ""
    
    # Volume variables
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"
    
    # ✅ PRIDANÉ: Získanie zoznamu všetkých športov
    included_sports = prefs.get("included_sports") or []
    if isinstance(included_sports, list):
        # Vyčistíme a uistíme sa, že main_sport je tam tiež
        included_sports = list(set([str(s).lower() for s in included_sports if s] + [main_sport]))
    else:
        included_sports = [main_sport]

    pref_obj = prefs.get("preferences") or {}
    if not isinstance(pref_obj, dict): pref_obj = {}

    two = pref_obj.get("two_a_day") or {}
    if not isinstance(two, dict): two = {}
    two_enabled = bool(two.get("enabled"))
    two_cap = _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2) if two_enabled else 0

    long_run_days = pref_obj.get("long_run_days") or []
    if not isinstance(long_run_days, list): long_run_days = []
    long_run_days = [str(d) for d in long_run_days if isinstance(d, str) and d.strip()]

    avoid_back_to_back_hard = bool(pref_obj.get("avoid_back_to_back_hard"))
    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"

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
        except Exception: strength_target_int = None
    else:
        legacy = (targets.get("strength") or {}).get("sessions_per_week") if isinstance(targets, dict) else None
        if isinstance(legacy, (int, float, str)):
            try: strength_target_int = int(legacy)
            except Exception: strength_target_int = None

    # Externé eventy a výpočet ich trvania
    ext = context_payload.get("external_events") or {}
    ext_occ = ext.get("occurrences") if isinstance(ext, dict) else []
    if not isinstance(ext_occ, list): ext_occ = []
    ext_count = len(ext_occ)
    
    # ✅ PRIDANÉ: Spočítame minúty v externých eventoch
    ext_minutes_total = 0
    for e in ext_occ:
        d = _safe_int(e.get("duration_min"), 0)
        ext_minutes_total += d

    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode") if isinstance(volume_prefs, dict) else None
    volume_value = volume_prefs.get("value") if isinstance(volume_prefs, dict) else None

    # ✅ UPRAVENÉ: Weekly intent zohľadňuje externé eventy
    if isinstance(planned_minutes, (int, float)):
        remaining_min = max(0, int(planned_minutes) - ext_minutes_total)
        weekly_volume_line = (
            f"- WEEKLY VOLUME INTENT:\n"
            f"  The TOTAL weekly target is approx {planned_minutes} min.\n"
            f"  External events already occupy {ext_minutes_total} min.\n"
            f"  You should schedule approximately {remaining_min} min of NEW training sessions to meet the goal.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        target_min = int(volume_value * 60)
        remaining_min = max(0, target_min - ext_minutes_total)
        weekly_volume_line = (
            f"- WEEKLY VOLUME INTENT:\n"
            f"  The TOTAL weekly target is approx {target_min} min.\n"
            f"  External events already occupy {ext_minutes_total} min.\n"
            f"  You should schedule approximately {remaining_min} min of NEW training sessions.\n"
        )
    else:
        weekly_volume_line = "- Weekly intent: infer from recent_load (soft), keeping in mind external events count towards load.\n"

    back_to_back_rule = (
        "- AVOID BACK-TO-BACK HARD (HARD): Do NOT schedule two hard sessions on consecutive days (consider external events too).\n"
        if avoid_back_to_back_hard
        else "- AVOID BACK-TO-BACK HARD (SOFT): Avoid back-to-back hard days when possible.\n"
    )

    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = f"{strength_target_int}× per week" if strength_target_int is not None else "not specified"
    blocks_str = ", ".join([k for k, v in blocks.items() if v]) if any(blocks.values()) else "none"

    # Medical Rules (active_injuries logic remains same...)
    active_injuries = prefs.get("injuries") or []
    injury_rule = ""
    if isinstance(active_injuries, list) and len(active_injuries) > 0:
        inj_details = []
        max_severity = 0
        for inj in active_injuries:
            if isinstance(inj, dict):
                area = inj.get("area", "unknown area")
                typ = inj.get("type", "unknown type")
                sev = _safe_int(inj.get("severity"), 0)
                if sev > max_severity: max_severity = sev
                inj_details.append(f"{area} ({typ}, severity: {sev}/10)")
        
        inj_str = ", ".join(inj_details)
        if max_severity >= 7:
            injury_rule = (
                "- CRITICAL MEDICAL RULE (HARD):\n"
                f"  The athlete reported a SEVERE injury: {inj_str}.\n"
                "  DO NOT SCHEDULE ANY PHYSICAL TRAINING. ZERO. NONE.\n"
                "  - Every single day in the plan MUST be set to session_type='rest' and sport='other'.\n"
                "  - Title should be 'Lekárske voľno' or 'Regenerácia'.\n"
                "  - Include medical disclaimer in notes.\n\n"
            )
        else:
            injury_rule = (
                "- ACTIVE INJURY (CRITICAL/HARD):\n"
                f"  The athlete has reported active injuries: {inj_str}.\n"
                "  You MUST adjust the plan for recovery. \n"
                "  - Replace high-intensity/hard sessions with REST or very light activity.\n"
                "  - Do NOT schedule workouts that would worsen the reported injury.\n\n"
            )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week. "
        "Your task is to design a detailed daily workout schedule. "
        "Return ONE valid JSON object only."
    )

    schema_text = """
{
  "schema_version": 3,
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
          "zone_text": string | null,
          "notes": string | null,
          "structure": { ... } | null,
          "payload"?: object | null
        }
      ]
    }
  ],
  "warnings"?: [string]
}
""".strip()

    date_integrity_rule = (
        "- DATE INTEGRITY (HARD):\n"
        "  Only use dates inside the given Week range. Do NOT invent dates.\n\n"
    )

    # ✅ UPRAVENÉ: External Rules teraz explicitne spomínajú Load a Intenzitu
    external_rules = (
        "- EXTERNAL EVENTS (HARD):\n"
        "  CONTEXT_JSON.external_events.occurrences contains fixed events from DB.\n"
        "  You MUST include EVERY occurrence EXACTLY ONCE, on the SAME date.\n"
        "  CRITICAL: These events COUNT towards the weekly volume and load.\n"
        "  - If an external event has high intensity, treat it as a HARD session for recovery purposes.\n"
        "  - Subtract their duration from the total weekly training time available.\n"
        "  Properties for external sessions:\n"
        "    - session_type = 'external_event'\n"
        "    - sport = occurrence.session_sport\n"
        "    - title = occurrence.title (exact)\n"
        "    - duration_min = occurrence.duration_min\n"
        "    - intensity = occurrence.intensity (easy|medium|hard)\n"
        "    - payload.external_event (HARD REQUIRED)\n\n"
    )

    two_a_day_rule = (
        "- TWO-A-DAY (HARD):\n"
        "  Prefer 1 session/day.\n"
        f"  You may schedule 2 sessions in a day on at most {two_cap} day(s) in the week.\n"
        "  If cap is 0, never schedule 2 sessions in a day.\n\n"
    )

    long_run_rule = (
        "- LONG RUN RULE (HARD WHEN POSSIBLE):\n"
        "  If main_sport is run, schedule exactly 1 long run in the week.\n"
        f"  Preferred weekdays: {long_run_days_str}.\n"
        "  Mark it explicitly: session_type='long_run'.\n\n"
    )

    # ✅ PRIDANÉ: Multi-sport Rule
    multi_sport_rule = ""
    if len(included_sports) > 1:
        other_sports = [s for s in included_sports if s != main_sport and s != "strength"]
        if other_sports:
            multi_sport_rule = (
                "- MULTI-SPORT MIX (HARD):\n"
                f"  The athlete performs these sports: {', '.join(included_sports)}.\n"
                f"  The main sport is {main_sport}, but you MUST schedule sessions for {', '.join(other_sports)} as well.\n"
                "  Create a balanced week including these sports based on standard triathlon/cross-training principles.\n\n"
            )

    strength_rule = (
        "- STRENGTH (PREF TARGET):\n"
        f"  Aim for {strength_str}. Use sport='strength'. Keep structure=null.\n\n"
    )

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (run, ride, swim):\n"
        "  For endurance workouts, provide a detailed `structure` object (warmup, main_part, cooldown).\n"
        "  Write instructions for absolute beginners.\n\n"
    )

    intensity_model_rule = (
        f"- INTENSITY MODEL: {intensity_model}.\n"
        "  Polarized = mostly easy + small amount hard. Pyramidal = allow more moderate.\n\n"
    )

    explanation_rule = (
        "- NOTES (HARD):\n"
        "  Every session MUST include 2–3 short, concrete sentences in `notes`.\n\n"
    )

    fallback_block = ""
    if not week_start or not week_end:
        fallback_block = (
            "\nFALLBACK MODE (missing week_start/week_end):\n"
            "- You MUST NOT invent calendar dates.\n"
            "- Return days: [] and add warnings: ['missing_week_range'].\n"
        )

    context_for_ai = _minify_context_for_ai(context_payload)

    safe_settings = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }
    context_for_ai["user_settings"] = safe_settings

    user_txt = (
        "Generate a full weekly training plan (calendar dates + sessions) based on the context JSON.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start or 'unknown'} .. {week_end or 'unknown'}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"Included sports: {', '.join(included_sports)}\n"
        f"External events occurrences in this week: {ext_count}\n\n"
        + date_integrity_rule
        + external_rules
        + injury_rule 
        + two_a_day_rule
        + long_run_rule
        + multi_sport_rule  # <--- Pridané
        + strength_rule
        + endurance_structure_rule 
        + intensity_model_rule
        + blocks_rule
        + weekly_volume_line # <--- Upravené
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

    return system_txt, user_txt, [], strength_target_int
