# Services/AI/advisor_review/prompts.py
"""
Prompty pre hodnotenie týždňa v advisor režime.

AI tu NEHODNOTÍ trénovanosť - tú si prečíta z 'athlete_state' a berie ju
ako hotový fakt. Jej jediná úloha je posúdiť ŠTRUKTÚRU tréningového týždňa
voči cieľu: či sedí rozloženie záťaže, či nie sú dva tvrdé tréningy za
sebou, či nechýba partia, či je dosť oddychu pred pretekom.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    """Vráti (jazyk_label, pravidlo_oslovovania) podľa nastavení."""
    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def _terminology_rule(lang_label: str) -> str:
    """
    Zabráni prenikaniu anglických koučovacích termínov do SK/CS textu
    a zlým prekladom svalových partií.
    """
    if lang_label == "English":
        return (
            "- MUSCLE GROUP NAMING: refer to muscle groups by their plain names - chest, back, "
            "shoulders, biceps, triceps, forearms, core, glutes, quads, hamstrings, calves. Never use "
            "movement-pattern jargon ('vertical pull', 'horizontal push', 'hinge') or internal codes.\n"
        )
    if lang_label == "Czech":
        return (
            "- TERMINOLOGY: Do NOT leave English coaching terms untranslated. Use Czech equivalents: "
            "'fatigue' -> 'únava', 'hard session' -> 'náročný trénink', 'threshold' -> 'prahový', "
            "'recovery' -> 'regenerace', 'volume' -> 'objem', 'taper' -> 'odlehčení'. "
            "MUSCLE GROUPS translate as: chest -> 'prsa', back -> 'záda', shoulders -> 'ramena', "
            "biceps -> 'biceps', triceps -> 'triceps', forearms -> 'předloktí', core -> 'střed těla / břicho', "
            "glutes -> 'hýždě', quads -> 'přední stehna', hamstrings -> 'zadní stehna', calves -> 'lýtka', "
            "legs -> 'nohy'. Use 'prsa', never 'hrudník'. NEVER write 'kalhoty' - that means trousers.\n"
        )
    return (
        "- TERMINOLOGY: Do NOT leave English coaching terms untranslated. Use Slovak equivalents: "
        "'fatigue' -> 'únava', 'hard session' -> 'náročný tréning', 'threshold' -> 'prahový', "
        "'recovery' -> 'regenerácia', 'volume' -> 'objem', 'taper' -> 'odľahčenie'. "
        "MUSCLE GROUPS translate as: chest -> 'prsia', back -> 'chrbát', shoulders -> 'ramená', "
        "biceps -> 'biceps', triceps -> 'triceps', forearms -> 'predlaktia', core -> 'stred tela / brucho', "
        "glutes -> 'zadok', quads -> 'predné stehná', hamstrings -> 'zadné stehná', calves -> 'lýtka', "
        "legs -> 'nohy'. Use 'prsia', never 'hrudník'. NEVER write 'nohavice' - that means trousers.\n"
    )



def _format_rules() -> str:
    """Formátovanie času a objemu vo voľnom texte."""
    return (
        "- DURATION FORMAT: never write raw minute counts for volume (not '573 minút'). "
        "Use 'H h MM min' (573 -> '9 h 33 min', 90 -> '1 h 30 min'); omit the hour part when zero "
        "(45 -> '45 min') and the minute part when exactly zero (120 -> '2 h').\n"
        "- INTERVAL FORMAT: 'work_s'/'rest_s' are seconds - write them as 'M:SS' (90 -> '1:30'). "
        "'work_m'/'rest_m' are metres - write them as metres or kilometres (400 -> '400 m').\n"
        "- NO RAW TECHNICAL VALUES: never write field names, booleans or codes in free text "
        "(not 'not_done', 'status', 'true'). Translate them into plain sentences.\n"
    )


def _week_rule(plan: Dict[str, Any]) -> str:
    """Pravidlo o rozsahu týždňa - kalendárny, nie rolling."""
    if not plan.get("has_active_plan"):
        return (
            "The athlete has NO active plan. Say so plainly, base 'last_week' only on "
            "'done_activities', leave 'upcoming_check' as a single point saying nothing is planned, "
            "and put all your advice into 'next_week_guidance'.\n"
        )

    days_left = plan.get("days_left_in_week")
    closing = (
        "It is SUNDAY - the week is closing. Review it as a whole.\n"
        if days_left == 0
        else
        f"There are {days_left} days left in this week - it is STILL IN PROGRESS. Judge it as a "
        "partial week and never blame the athlete for sessions that are simply still ahead.\n"
    )

    return (
        "The plan covers the CURRENT CALENDAR WEEK (Monday-Sunday):\n"
        "  - 'plan.past_days' = Monday up to yesterday, each with status "
        "(done / not_done / missed / postponed)\n"
        "  - 'plan.upcoming_days' = today up to Sunday - still ahead THIS week\n"
        "  - 'plan.next_week' (if present) = what is already planned for next week\n"
        "  - 'done_activities' = what the athlete ACTUALLY did in the last 14 days, including "
        "sessions that were never in the plan\n"
        + closing
    )


def _state_rule(state: Optional[Dict[str, Any]]) -> str:
    """
    Athlete state je HOTOVÝ FAKT, nie niečo, čo má AI prepočítavať.
    """
    if not state:
        return (
            "- ATHLETE STATE: no analysis available yet. Do NOT guess the athlete's fitness, fatigue "
            "or injury risk. Judge the plan structure on its own and, if relevant, mention in one "
            "clause that a fresh athlete analysis would make the advice more precise.\n"
        )

    age = state.get("age_days")
    age_note = (
        f"  The analysis is {age} days old - treat it as a current fact.\n"
        if age is not None and age <= 10
        else
        f"  The analysis is {age} days old, so it may be out of date - lean on the plan and on "
        "'done_activities' and do not over-weight it.\n"
        if age is not None
        else ""
    )

    return (
        "- ATHLETE STATE (READ-ONLY FACT): 'athlete_state' holds the athlete's current fitness "
        "assessment - fatigue_level, injury_risk, volume_tolerance, intensity_tolerance, "
        "suggested_block_kind. USE it to judge whether the plan is appropriate, but do NOT "
        "re-evaluate or contradict it, and do NOT comment on paces, VO2max or race time estimates - "
        "that is not your job here.\n"
        + age_note
    )

def _proper_names_rule() -> str:
    """
    Vlastné mená a názvy cvikov.

    Dôvod: model preložil názov preteku "Urban Trail" na "Urbannú trať"
    a cviky nechal v angličtine ("leg extension, hamstring curl"), hoci
    kontext ich posiela aj s menom z katalógu.
    """
    return (
        "- PROPER NAMES: race names from 'goal.races' are proper nouns - write them EXACTLY as given, "
        "never translate or inflect them (e.g. 'Urban Trail' stays 'Urban Trail', never 'Urbannú trať'). "
        "The same applies to session titles the athlete typed themselves.\n"
        "- EXERCISE NAMES: 'plan.*.structure.exercises[].name' holds the exercise name. Refer to exercises "
        "by a natural name in the athlete's language, never by an English term the athlete would not use "
        "and never by an exercise id. If you are unsure of the translation, describe the movement instead "
        "(e.g. 'ťažké cviky na nohy' rather than 'leg extension a hamstring curl').\n"
        "- RACE COUNTDOWN: whenever you mention how far a race is, count from TODAY using "
        "'goal.races[].days_until'. Do not shift the number because you are talking about next week - "
        "if the race is 15 days away, it is 15 days away in every sentence.\n"
    )

def _muscle_rule(muscle: Optional[Dict[str, Any]]) -> str:
    """Objem na partie - rovnaké čísla, aké athlete vidí v appke."""
    if not muscle:
        return (
            "- MUSCLE VOLUME: no strength sets logged or planned this week. If strength is part of the "
            "athlete's goal, say that it is missing - but do not guess which muscle groups.\n"
        )
    return (
        "- MUSCLE VOLUME (USE MUSCLE NAMES): 'muscle_volume.muscles' lists each muscle group with "
        "'sets_done' (logged this week), 'sets_planned' (still scheduled), 'target' (weekly goal) and "
        "'status'. These are the exact numbers the athlete sees in the app.\n"
        "  - Always use muscle group names the athlete understands - chest, back, shoulders, biceps, "
        "triceps, forearms, core, glutes, quads, hamstrings, calves (in their language). NEVER use "
        "movement-pattern jargon like 'vertical pull' or 'hinge', and never write exercise ids.\n"
        "  - Name the muscle groups that are neglected and those already at target, with the real "
        "numbers (e.g. 'chrbát máš 8,5 z 12 sérií, brucho len 2').\n"
        "  - Fractional values (1.5, 8.5) are correct - an exercise counts fully for its primary "
        "muscles and half for assisting ones. Report them as they are.\n"
        "  - If 'run_volume_tier' is 'high', leg targets are intentionally lower because running "
        "already loads the legs - do NOT tell the athlete to add leg volume in that case.\n"
    )


def _health_rule(health: Optional[list]) -> str:
    """Zdravotné záznamy."""
    if not health:
        return ""
    return (
        "- ACTIVE HEALTH ISSUES: 'active_health_issues' lists current injuries/illness with severity "
        "(1-10). Factor them into every judgement about the plan. If any severity is 7 or higher, "
        "'health_warning' MUST be filled - advise reducing or skipping training and seeing a doctor "
        "for severe pain.\n"
    )


def _schema(lang_label: str) -> str:
    """JSON schéma výstupu - zhodná s tým, čo už zobrazuje karta v appke."""
    return f"""
{{
  "headline": "1 punchy sentence in {lang_label}, 2nd person",
  "last_week": {{
    "assessment": "2-3 sentences on how the week is structured and executed",
    "went_well": ["max 3 short points"],
    "to_improve": ["max 3 short points"]
  }},
  "upcoming_check": ["max 4 short points about what is still planned"],
  "next_week_guidance": {{
    "summary": "2-3 sentences",
    "suggested_structure": ["max 6 short verbal points, e.g. '2x ľahký beh 40-50 min v Z2'"]
  }},
  "health_warning": "max 1 sentence" | null
}}
""".strip()


def build_prompts_for_advisor_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """Zostaví (system_prompt, user_prompt) pre hodnotenie týždňa."""
    settings = settings or {}
    lang_label, second_person = _lang_notes(settings)

    plan = context_payload.get("plan") or {}
    state = context_payload.get("athlete_state")
    muscle = context_payload.get("muscle_volume")
    health = context_payload.get("active_health_issues")

    system_txt = (
        "You are an experienced endurance coach reviewing a training plan that the ATHLETE built "
        "themselves. You are a mentor, NOT a planner - you never rewrite their plan, you tell them "
        "what works, what does not, and what to do next. "
        "Return a SINGLE valid JSON object. No prose, no code fences."
    )

    user_txt = (
        "Review the athlete's training week and fill the schema.\n\n"
        "YOUR JOB: judge the STRUCTURE of the training week against the athlete's goal - load "
        "distribution, hard/easy balance, recovery, muscle group coverage, race preparation. "
        "You are NOT assessing their fitness level, paces or race predictions - that comes from "
        "'athlete_state' and is already decided.\n\n"
        + _week_rule(plan)
        + "\nCONTEXT_JSON:\n"
        + json.dumps(context_payload, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label)
        + "\n\nRULES:\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person}\n"
        "- last_week: honest, concrete assessment - refer to specific days by weekday name. Compare "
        "what was planned with what was actually done ('done_activities'), including unplanned "
        "sessions. If the week is still running, say so instead of judging it as finished.\n"
        "- upcoming_check: flag concrete problems in what is still planned - two hard sessions on "
        "consecutive days, a hard session right after a long run or right before a race, a big volume "
        "jump, no rest day, heavy leg strength the day before a key run, a conflict with an active "
        "injury. If the plan looks good, say so in one short point. If nothing is planned, say that.\n"
        "- next_week_guidance: VERBAL recommendations for the NEXT calendar week - session types, "
        "counts, approximate durations and zones, where the long run fits, where rest and strength go. "
        "Do NOT write a day-by-day plan with dates and do NOT present sessions as already scheduled - "
        "the athlete decides. If a muscle group is under its weekly target, say which one to "
        "prioritise, by muscle group name, not by listing exercises.\n"
        "- RACES: if 'goal.races' contains a race within 21 days, that drives everything - say whether "
        "the plan is specific enough and whether the athlete should start tapering.\n"
        + _state_rule(state)
        + _muscle_rule(muscle)
        + _health_rule(health)
        + _format_rules()
        + _proper_names_rule()
        + _terminology_rule(lang_label)
        + "- Tone: experienced mentor - direct, specific, supportive. No generic filler, no praise "
        "that is not backed by the data.\n"
        "- Never invent numbers that are not in the context.\n"
        "- Return ONLY raw JSON.\n"
    )

    return system_txt, user_txt