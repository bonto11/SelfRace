# Services/AI/daily_plan/prompts/__init__.py
"""
Zostavovač promptu pre daily plan generátor.

build_prompts_for_daily() je JEDINÁ verejná funkcia tohto balíka -
`from Services.AI.daily_plan.prompts import build_prompts_for_daily`
funguje presne ako predtým, keď to bol jeden súbor prompts.py, takže
Services/AI/daily_plan/generate.py sa NEMUSÍ meniť.

Tento súbor len ZBIERA hodnoty z context_payload a VOLÁ stavebné funkcie
z jednotlivých rules_*.py modulov v správnom poradí - žiadna promptová
logika (texty inštrukcií) tu priamo nie je, aby sa dala každá časť
(schedule/endurance/strength/...) upravovať nezávisle.

⚠️ DEPLOY: pri nasadení zmaž starý Services/AI/daily_plan/prompts.py
(jeden súbor) - inak by v tom istom balíku existoval aj modul, aj
súbor s rovnakým menom.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple

from Services.AI.daily_plan.prompts.common import (
    _safe_int,
    _as_dict,
    _get_dict,
    _flatten_prefs,
    _lang_notes,
    _time_format_rule,
    _terminology_rule,
    minify_daily_context_for_ai,
)
from Services.AI.daily_plan.prompts.schema import build_daily_schema
from Services.AI.daily_plan.prompts.rules_special import build_special_reason_rule
from Services.AI.daily_plan.prompts.rules_athlete_notes import (
    build_beginner_rule,
    build_athlete_instructions_rule,
)
from Services.AI.daily_plan.prompts.rules_schedule import (
    build_rest_days_rule,
    build_two_a_day_rule,
    build_back_to_back_rule,
    build_multi_sport_rule,
    build_sports_restriction_rule,
    build_weekly_volume_line,
)
from Services.AI.daily_plan.prompts.rules_endurance import (
    check_has_zones,
    build_intensity_format_rule,
    build_endurance_structure_rule,
    build_long_run_rule,
    build_intensity_model_line,
    build_training_blocks_line,
)
from Services.AI.daily_plan.prompts.rules_strength import (
    build_strength_count_rule,
    build_strength_structure_rule,
)


def build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre daily týždenný plán.
    Vracia Tuple[str, str]. Verejné API - nezmenené oproti pôvodnému
    monolitickému prompts.py.
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

    # Zoznam sportov — pridaj strength ak má naplánované sessions
    sports_set = {main_sport}
    for key in ("add_on_sports", "included_sports"):
        lst = prefs.get(key)
        if isinstance(lst, list):
            sports_set.update(s.lower() for s in lst if isinstance(s, str) and s)

    # 🌟 ZMENA (vrstva 1+2): strength sa do sports_set pridáva podľa
    # REÁLNEHO počtu hotových sessions v strength_sessions_plan, nie podľa
    # cieľového čísla z prefs - to dvoje sa môže rozísť (napr. ak
    # build_strength_session v builderi zlyhal a degradoval na []).
    strength_sessions_plan = constraints.get("strength_sessions_plan") or []
    if not isinstance(strength_sessions_plan, list):
        strength_sessions_plan = []
    strength_session_count = len(strength_sessions_plan)
    if strength_session_count > 0:
        sports_set.add("strength")

    strength_progression_context = constraints.get("strength_progression_context") or []
    if not isinstance(strength_progression_context, list):
        strength_progression_context = []

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
    has_zones = check_has_zones(zones_data)

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

    # --- postav jednotlivé pravidlá cez rules_*.py ---
    weekly_volume_line = build_weekly_volume_line(
        planned_minutes=planned_minutes,
        volume_mode=volume_mode,
        volume_value=volume_value,
        ext_minutes_total=ext_minutes_total,
    )
    rest_days_rule = build_rest_days_rule(days_off)
    two_a_day_rule = build_two_a_day_rule(two_enabled, two_cap)
    strength_count_rule = build_strength_count_rule(strength_session_count)
    long_run_rule = build_long_run_rule(long_run_days)
    back_to_back_rule = build_back_to_back_rule(avoid_back_to_back)
    multi_sport_rule = build_multi_sport_rule(final_sports_list, main_sport)
    beginner_rule = build_beginner_rule(is_returning_beginner)

    latest_paces = _as_dict(context_payload.get("latest_paces"))
    intensity_format_rule = build_intensity_format_rule(has_zones, latest_paces, lthr)
    endurance_structure_rule = build_endurance_structure_rule()

    # 🌟 PREPÍSANÉ: strength už len kopíruje hotovú kostru zo selectora,
    # nevyberá cviky ani nepočíta dĺžku (viď rules_strength.py docstring).
    strength_structure_rule = build_strength_structure_rule(
        strength_sessions_plan, strength_progression_context, lang_label
    )

    intensity_model_line = build_intensity_model_line(intensity_model, has_zones)
    training_blocks_line = build_training_blocks_line(blocks)

    special_reason_rule = build_special_reason_rule(context_payload.get("generate_reason"))

    coach_notes = _as_dict(context_payload.get("coach_notes"))
    sticky_notes = coach_notes.get("sticky_notes") or []
    ephemeral_note = coach_notes.get("ephemeral_note")
    notes_rule = build_athlete_instructions_rule(sticky_notes, ephemeral_note)

    sports_restriction = build_sports_restriction_rule(final_sports_list)

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
        + strength_count_rule
        + sports_restriction
        + intensity_format_rule
        + _time_format_rule()
        + _terminology_rule(lang_label)
        + endurance_structure_rule
        + strength_structure_rule
        + intensity_model_line
        + training_blocks_line
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
        + build_daily_schema(lang_label)
        + "\n\nRequirements:\n"
        "- Single valid JSON matching schema.\n"
        f"- Language: {lang_label}. {second_person_note}\n"
        "- Do NOT invent extreme workloads. Check recent_load to avoid huge volume spikes.\n"
        "- Return ONLY valid JSON. No markdown, no explanations before or after.\n"
    )

    return system_txt, user_txt
