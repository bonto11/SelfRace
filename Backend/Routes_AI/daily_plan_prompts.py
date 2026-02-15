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

def _minify_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    context2: Dict[str, Any] = {}
    for k in ("week", "zones", "thresholds", "recent_load", "external_events"):
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

    context2["prefs"] = {
        "weeks": prefs.get("weeks"),
        "start_date": prefs.get("start_date"),
        "end_date": prefs.get("end_date"),
        "main_sport": prefs.get("main_sport"),
        "add_on_sports": prefs.get("add_on_sports"),
        "goal_kind": prefs.get("goal_kind"),
        "volume": prefs.get("volume"),
        "targets": prefs.get("targets"),
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
    context2["athlete_state"] = {"ai_state": ai_state}

    for k in ("last_activities",):
        if k in context: context2[k] = context[k]

    us = context.get("user_settings") or {}
    if isinstance(us, dict):
        context2["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }

    return context2

def _build_prompts_for_daily(
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
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"

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

    ext = context_payload.get("external_events") or {}
    ext_occ = ext.get("occurrences") if isinstance(ext, dict) else None
    ext_count = len(ext_occ) if isinstance(ext_occ, list) else 0

    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode") if isinstance(volume_prefs, dict) else None
    volume_value = volume_prefs.get("value") if isinstance(volume_prefs, dict) else None

    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = f"- Weekly intent: planned_minutes ≈ {planned_minutes} min (soft).\n"
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = f"- Weekly intent: prefs.volume weekly_hours ≈ {volume_value * 60:.0f} min (soft).\n"
    else:
        weekly_volume_line = "- Weekly intent: infer from recent_load (soft).\n"

    back_to_back_rule = (
        "- AVOID BACK-TO-BACK HARD (HARD): Do NOT schedule two hard sessions on consecutive days.\n"
        if avoid_back_to_back_hard
        else "- AVOID BACK-TO-BACK HARD (SOFT): Avoid back-to-back hard days when possible.\n"
    )

    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = f"{strength_target_int}× per week" if strength_target_int is not None else "not specified"
    blocks_str = ", ".join([k for k, v in blocks.items() if v]) if any(blocks.values()) else "none"

    # ✅ MEDICAL LIABILITY: Rozlíšenie medzi ľahkými a ťažkými zraneniami
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
                if sev > max_severity:
                    max_severity = sev
                inj_details.append(f"{area} ({typ}, severity: {sev}/10)")
        
        inj_str = ", ".join(inj_details)

        # 🚨 SEVERITY 7-10: TVRDÁ STOPKA
        if max_severity >= 7:
            injury_rule = (
                "- CRITICAL MEDICAL RULE (HARD):\n"
                f"  The athlete reported a SEVERE injury: {inj_str}.\n"
                "  DO NOT SCHEDULE ANY PHYSICAL TRAINING. ZERO. NONE.\n"
                "  - Every single day in the plan MUST be set to session_type='rest' and sport='other'.\n"
                "  - Title should be 'Lekárske voľno' or 'Regenerácia'.\n"
                "  - In the `notes` for the very first day, you MUST include this exact medical disclaimer: "
                "    'Zaznamenali sme vysoký stupeň bolesti. Aplikácia nenahrádza lekársku starostlivosť. "
                "Bezodkladne vyhľadaj lekára alebo fyzioterapeuta. Tréningový plán je pozastavený, kým zranenie "
                "nevyliečiš a nezmažeš ho z profilu.'\n\n"
            )
        # ⚠️ SEVERITY 1-6: ZVOĽNENIE
        else:
            injury_rule = (
                "- ACTIVE INJURY (CRITICAL/HARD):\n"
                f"  The athlete has reported active injuries: {inj_str}.\n"
                "  You MUST adjust the plan for recovery. \n"
                "  - Replace high-intensity/hard sessions with REST, recovery walks, or very light cross-training.\n"
                "  - Explicitly mention the injury adaptation in the session `notes`.\n"
                "  - Do NOT schedule workouts that would worsen the reported injury.\n\n"
            )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON for ONE training week. "
        "Return ONE valid JSON object only. No prose, no code fences."
    )

    schema_text = """
{
  "schema_version": 3,
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
          "structure": {
            "warmup": { "duration_min": number, "target": string, "instruction": string },
            "main_part": [
              {
                "kind": "steady" | "interval_block",
                "repeats": number | null,
                "work": { "duration_min": number, "target": string, "instruction": string } | null,
                "rest": { "duration_min": number, "target": string, "instruction": string } | null,
                "duration_min": number | null,
                "target": string | null,
                "instruction": string | null
              }
            ],
            "cooldown": { "duration_min": number, "target": string, "instruction": string }
          } | null,
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
        "  Only use dates inside the given Week range (week_start..week_end inclusive).\n"
        "  Do NOT invent dates outside this range.\n\n"
    )

    external_rules = (
        "- EXTERNAL EVENTS (HARD):\n"
        "  CONTEXT_JSON.external_events.occurrences contains date-based external events from DB.\n"
        "  You MUST include EVERY occurrence EXACTLY ONCE, on the SAME date.\n"
        "  Do NOT move them. Do NOT duplicate them. Do NOT rename titles.\n"
        "  For each external event session you MUST set ALL of these:\n"
        "    - session_type = 'external_event'\n"
        "    - sport = occurrence.session_sport\n"
        "    - title = occurrence.title (exact)\n"
        "    - duration_min = occurrence.duration_min (if missing, choose a reasonable default AND say you guessed it in notes)\n"
        "    - intensity = occurrence.intensity if present (easy|medium|hard), otherwise null\n"
        "    - structure = null\n"
        "    - zone_text = null\n"
        "    - payload.external_event (HARD REQUIRED) with exact keys: date, title, sport_raw, start_time_local, duration_min, priority, intensity\n\n"
    )

    two_a_day_rule = (
        "- TWO-A-DAY (HARD):\n"
        "  Prefer 1 session/day.\n"
        f"  You may schedule 2 sessions in a day on at most {two_cap} day(s) in the week.\n"
        "  If cap is 0, never schedule 2 sessions in a day.\n"
        "  If you schedule a 2-a-day, explain why in notes.\n\n"
    )

    long_run_rule = (
        "- LONG RUN RULE (HARD WHEN POSSIBLE):\n"
        "  If main_sport is run, schedule exactly 1 long run in the week.\n"
        f"  Preferred weekdays: {long_run_days_str}.\n"
        "  If there is NO hard conflict on preferred weekdays, you MUST place the long run on ONE of the preferred weekdays.\n"
        "  Mark it explicitly: session_type='long_run'.\n\n"
    )

    strength_rule = (
        "- STRENGTH (PREF TARGET):\n"
        f"  Aim for {strength_str}.\n"
        "  Keep strength SIMPLE:\n"
        "    - set structure=null\n"
        "    - do NOT list exercises (mapper will do it)\n"
        "  Use sport='strength'.\n\n"
    )

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (run, ride, swim):\n"
        "  For endurance workouts, you MUST provide a detailed `structure` object.\n"
        "  Write instructions for absolute beginners. Explain exactly what they should do and feel.\n"
        "  - `warmup`: Explain pace and feeling (e.g. 'Pomalý poklus na zahriatie, môžeš dýchať nosom').\n"
        "  - `main_part`: Provide an array of blocks. \n"
        "     If it is a steady run, use kind='steady' with `duration_min`, `target` (e.g. 'Z2 140-150 bpm') and `instruction`.\n"
        "     If it is an interval session, use kind='interval_block' with `repeats`, `work` (duration, target, instruction) and `rest` (duration, target, instruction).\n"
        "  - `cooldown`: Explain how to cool down (e.g. 'Voľná chôdza na upokojenie tepu').\n"
        "  Use concrete numbers for targets (Pace or HR bpm) based on athlete's zones from context.\n\n"
    )

    intensity_model_rule = (
        "- INTENSITY MODEL (GUIDANCE):\n"
        f"  preferences.intensity_model = '{intensity_model}'.\n"
        "  If 'polarized': keep most volume easy/recovery, with a small number of hard sessions.\n"
        "  If 'pyramidal': still mostly easy, but allow more moderate work.\n\n"
    )

    blocks_rule = (
        "- TRAINING BLOCKS (GUIDANCE):\n"
        f"  preferences.training_blocks enabled: {blocks_str}.\n"
        "  If a block is enabled, include at most ONE session aligned with it in this week.\n\n"
    )

    explanation_rule = (
        "- NOTES (HARD):\n"
        "  Every session MUST include 2–3 short, concrete sentences in `notes`.\n"
        "  1) Why this session is today.\n"
        "  2) What to focus on (e.g. cadence, posture).\n"
        "  No fluff, no emojis.\n\n"
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
        f"External events occurrences in this week: {ext_count}\n\n"
        + date_integrity_rule
        + external_rules
        + injury_rule 
        + two_a_day_rule
        + long_run_rule
        + strength_rule
        + endurance_structure_rule 
        + intensity_model_rule
        + blocks_rule
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

    return system_txt, user_txt, [], strength_target_int