# Services/AI/prefs_suggest/prompts.py
"""
Prompt pre návrh nastavenia coach prefs z textu cieľa. AI navrhne len zmeny
povolených polí (fields.py) a ku každej povie prečo a ako sa prejaví v pláne.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Tuple

from Services.AI.session_preview.prompts import _lang_notes, _name_usage_rule, _terminology_rule
from Services.AI.session_suggest.prompts import _remove_empty
from Services.AI.prefs_suggest.fields import DAYS, GOALS, SPORTS, STRENGTH_GOALS


def _schema(lang_label: str) -> str:
    return f"""
{{
  "reply_text": "2-4 sentences in {lang_label}: how you understood the goal and what the settings will do",
  "changes": [
    {{
      "field": "one of the FIELDS below",
      "value": "new value in the exact format of that field",
      "value_text": "the new value in words in {lang_label} (e.g. 'Zlepšiť rýchlosť', '4 h týždenne', 'Utorok a štvrtok')",
      "from_text": "the current value in words in {lang_label}, or null when not set",
      "why": "1 sentence in {lang_label}: why this fits the goal",
      "effect": "1 sentence in {lang_label}: what changes in the generated plan"
    }}
  ],
  "todo": ["0-3 short things in {lang_label} the athlete must set or do themselves (add a race, equipment, a new plan)"]
}}
""".strip()


def _fields_doc() -> str:
    return (
        "FIELDS (only these may appear in 'changes'):\n"
        f"- goal_kind: one of {list(GOALS)} (lose_weight / health = non-performance goals)\n"
        f"- main_sport: one of {list(SPORTS)}; add_on_sports: list from {list(SPORTS)} without main_sport\n"
        "- weeks: plan length in weeks, 1-52\n"
        "- volume: {\"mode\": \"weekly_hours\", \"value\": 1-40 (step 0.5)} or "
        "{\"mode\": \"daily_minutes\", \"value\": 15-300}\n"
        f"- preferences.days_off, preferences.long_run_days: lists of {list(DAYS)}\n"
        "- preferences.avoid_back_to_back_hard: true/false\n"
        "- preferences.intensity_model: 'polarized' (mostly easy + a little very hard) or 'pyramidal' "
        "(more moderate/tempo work)\n"
        "- preferences.two_a_day: {\"enabled\": bool, \"max_days_per_week\": 0-2}\n"
        "- strength_settings.sessions_per_week: 0-5 (0 = no strength at all)\n"
        "- strength_settings.session_duration_min: 30-90\n"
        f"- strength_settings.goal: one of {list(STRENGTH_GOALS)} (general_resilience = injury "
        "prevention and support for the sport; strength_endurance; max_strength = strength without "
        "much muscle gain; hypertrophy = muscle gain; power = explosiveness)\n"
        "- strength_settings.sport_specificity: low / balanced / high (how specific to the race type)\n"
    )


def _rules() -> str:
    return (
        "- TASK: the athlete describes what they want; translate it into SETTINGS. Propose only fields "
        "whose value should really change ('current_settings' shows today's values) - an unchanged value "
        "is not a change. Fewer good changes beat many. If the settings already fit, return no changes "
        "and say so in reply_text.\n"
        "- FIXED FACTS: never change or propose coach_mode, races, equipment, strength experience or "
        "injuries ('fixed_facts'). If the goal needs one of them (e.g. a race date for the January "
        "preparation, equipment for gym work), put it in 'todo'.\n"
        "- REALITY: volume must fit the time the athlete says they have and 'recent_weeks' - no big "
        "jumps. Respect active problems in 'health_records'.\n"
        "- PLAN: if fixed_facts.has_active_plan is true, the 'effect' says the change shows in the next "
        "generated plan, and 'todo' may suggest generating a new plan. In advisor mode (coach_mode = "
        "'advisor') the settings guide the reviews and suggestions, not a generated plan - say it that "
        "way.\n"
        "- CONVERSATION: if 'conversation' is not empty, the last 'athlete_request' adjusts your last "
        "proposal - return the full updated list of changes.\n"
        "- TEXT: no field names, enum values or true/false in any text - use words. No plain English "
        "words in Slovak/Czech text; established sport terms are fine (tempo, fartlek, tibialis).\n"
    )


def build_prompts_for_prefs_suggest(payload: Dict[str, Any]) -> Tuple[str, str]:
    settings = payload.get("settings") or {}
    user = payload.get("user") or {}
    lang = payload.get("lang") or "sk"
    lang_label, second_person = _lang_notes(settings, user_data=user)

    context_for_llm = _remove_empty(json.loads(json.dumps(payload.get("context") or {}, default=str)))
    if user.get("gender"):
        context_for_llm["athlete_gender"] = user["gender"]

    system_txt = (
        "You are an experienced endurance and strength coach setting up the athlete's training "
        "preferences in a training app. You explain every change simply. Return ONE valid JSON "
        "object only. No markdown."
    )
    user_txt = (
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label)
        + "\n\n"
        + _fields_doc()
        + "\nRULES:\n"
        + f"- Language: {lang_label}. {second_person}\n"
        + _name_usage_rule(user.get("first_name"), lang)
        + _terminology_rule(lang_label)
        + _rules()
        + "- Return ONLY raw JSON."
    )
    return system_txt, user_txt
