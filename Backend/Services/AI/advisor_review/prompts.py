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

def _events_rule() -> str:
    """
    Iné aktivity a udalosti v pláne.

    Dôvod: advisor musí rozlíšiť tréning od záťaže, ktorá tréning nie je.
    Svadba athléta unaví rovnako ako tvrdý tréning, ale do objemu nepatrí -
    bez tohto rozlíšenia by AI buď hlásila prepálený týždeň, alebo by
    naplánovala dlhý beh na deň po celodennej udalosti.
    """
    return (
        "- OTHER ACTIVITIES AND EVENTS: a session with sport 'other' is NOT a training session - it is "
        "a life event or an activity outside the plan (a wedding, a team-building day, moving house, "
        "a hike, football with friends). Its structure holds:\n"
        "  'event_kind' (sport / work / social / chore / travel / other), 'load' (easy / moderate / "
        "hard) with a plain-language 'load_hint', and 'counts_as_training'.\n"
        "  - Treat a 'hard' event as a real recovery cost even when counts_as_training is false: do not "
        "put a key session the day after it, and say so if the athlete already has one planned.\n"
        "  - An event with counts_as_training false must NOT be added to weekly training volume - an "
        "8-hour wedding is not 8 hours of training. Mention it as a constraint on the week, not as load.\n"
        "  - Entries marked 'is_external' are recurring commitments the athlete set up in their settings "
        "(a weekly football game). They are fixed - never suggest removing or moving them, plan around "
        "them instead.\n"
        "  - Refer to events by their title, naturally. Never write 'external_event' or raw kind codes.\n"
    )


def _week_rule(plan: Dict[str, Any]) -> str:
    """
    Ktorý týždeň sa hodnotí a pre ktorý sa radí - viď builders.review_window.
    Sekcie sa tak neprekrývajú (predtým pondelok hodnotil prázdny týždeň).
    """
    if not plan.get("has_active_plan"):
        return (
            "The athlete has NO active plan. Say so plainly, base 'last_week' only on "
            "'done_activities', leave 'upcoming_check' as a single point saying nothing is planned, "
            "and put all your advice into 'next_week_guidance'.\n"
        )

    if plan.get("review_mode") == "previous_week":
        return (
            "REVIEW MODE: it is early in the week. 'plan.reviewed_week' = the PREVIOUS week, already "
            "finished - review it as a whole in 'last_week' (use 'reviewed_week_totals'). "
            "'plan.plan_week' = the CURRENT week: 'upcoming_check' checks what is already in it from "
            "today on, and 'next_week_guidance' says what to ADD to the current week - count the "
            "sessions already planned there and never suggest them twice.\n"
        )

    days_left = (plan.get("reviewed_week") or {}).get("days_left")
    closing = (
        "The week is closing - review it as a whole.\n"
        if days_left == 0
        else
        f"There are {days_left} days left in it - judge it as a partial week and never blame the "
        "athlete for sessions that are simply still ahead.\n"
    )
    return (
        "REVIEW MODE: 'plan.reviewed_week' = the CURRENT week (statuses done / not_done / planned) - "
        "review it in 'last_week' (use 'reviewed_week_totals'); 'upcoming_check' covers its "
        "remaining days only. 'plan.plan_week' = NEXT week - 'next_week_guidance' is for it, "
        "counting anything already planned there.\n"
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
        "assessment - fatigue_level, injury_risk, suggested_block_kind. USE it to judge whether the "
        "plan is appropriate, but do NOT re-evaluate or contradict it, and do NOT comment on paces, "
        "VO2max or race time estimates - that is not your job here.\n"
        "- HARD LIMITS: 'athlete_state.limits' are binding. Weekly volume = exactly "
        "'limits.weekly_volume' (quote it as written, never your own range) and never more hard "
        "sessions than 'limits.hard_sessions_per_week_max'.\n"
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
        "numbers (e.g. 'chrbát máš 8 z 12 sérií, brucho len 2'). Numbers are whole sets - write "
        "them as given.\n"
        "  - RACE PHASE: if a race is within 21 days, set targets are INFORMATION only, not a task - "
        "never open the guidance with adding upper-body or arm sets; running quality, freshness and "
        "the race come first. Mention muscle groups at most in one point.\n"
        "  - CORE has no upper limit - core work is cheap and useful for running and trail; never "
        "advise against it because it is above target.\n"
        "  - If 'run_volume_tier' is 'high', leg targets are intentionally lower because running "
        "already loads the legs - do NOT tell the athlete to add leg volume in that case.\n"
    )


def _health_rule(health: Optional[list], recovery: Optional[dict]) -> str:
    """
    Zdravie a ranné recovery. PREČO: user sa vracal po chorobe zapísanej
    deň predtým, mal ju aj v poznámkach k noci, a hodnotenie ju vôbec
    nespomenulo - advisor videl len aktívne záznamy a žiadne recovery.
    """
    out = ""
    if health:
        out += (
            "- HEALTH: 'health_records' = illness / injury / fatigue / menstruation (severity 1-10), "
            "'active' or 'resolved' with days_since_end. Factor them into every judgement.\n"
            "  - active illness or injury -> fill 'health_warning' (one sentence); severity 7+ -> "
            "advise skipping training and seeing a doctor for severe pain.\n"
            "  - resolved within the last 7 days -> the athlete is RETURNING: say so once (e.g. "
            "'po chorobe pred 2 dňami') and ease back in - first sessions easy, no hard session "
            "in the first days.\n"
            "  - fatigue and menstruation are normal temporary states, not illness - adjust "
            "matter-of-factly, without dramatizing.\n"
        )
    if recovery:
        out += (
            "- MORNING RECOVERY: 'recovery.recent_days' (days_ago 0 = today) holds HRV, resting HR, "
            "sleep, factors and the athlete's note, with baselines. Mention the concrete signals "
            "that affect this week - HRV or resting HR clearly off baseline, short sleep, symptoms "
            "in the notes - in one point. A drop with an obvious cause (alcohol) is not a warning "
            "sign; a drop with symptoms is.\n"
        )
    return out


def _review_quality_rule() -> str:
    """
    Pravidlá z reálneho hodnotenia: ten istý beh bol v "podarilo sa" aj
    v "zapracovať", choroba sa opakovala v každej sekcii, nohy pred
    pretekom bez prípravy a OCR pretek bez jedinej špecifickej rady.
    """
    return (
        "- ONE PLACE PER FACT: never praise and criticise the same session - pick one section. "
        "A high heart rate at an unusually slow pace during an active illness is a sign of the "
        "illness, not of effort - say it once, that way.\n"
        "- NO CONTRADICTIONS: next_week_guidance.summary must agree with upcoming_check - if you "
        "approve a session on a given day there, do not tell the athlete to move it in the summary. "
        "Write the summary from the concrete plan, not generically.\n"
        "- VOLUME BELOW RANGE is a neutral fact (or a sign of missing training), never a success like "
        "'you did not overload'.\n"
        "- HEALTH ONCE: an active illness/injury goes into 'health_warning' and at most ONE other "
        "point. Do not repeat it in every section.\n"
        "- LEGS BEFORE A RACE: if glutes/quads/hamstrings got little or no strength work recently "
        "and a race is within 21 days, recommend only low leg volume, no heavy or eccentric leg "
        "exercises, and no leg strength in the last 7 days before the race (soreness risk).\n"
        "- OCR: if a race has race_type 'ocr' or is an obstacle race (Spartan, Tough Mudder, "
        "Hyrox...), add one point with its specifics - grip, carrying loads, burpees, short steep "
        "efforts - building on what the athlete already trains.\n"
    )


def _race_week_rule() -> str:
    """Pretek v plánovanom týždni - taper a pretek ako pevný bod."""
    return (
        "- RACE IN THE PLANNED WEEK: 'goal.races[].week' says where a race falls ('plan_week', "
        "'week_after_plan', 'reviewed_week', 'this_week', 'later') and 'weekday' its day. If a race is in 'plan_week', "
        "the guidance MUST include the race as a fixed point on its weekday and a taper before it: "
        "last hard session 4-5 days before, the day before rest or a short easy shake-out, and no "
        "long run or hard session on or right before race day.\n"
        "  If a race is in 'week_after_plan', the planned week is the last one before race week: "
        "no volume increase, the key session early in the week, and say that race week comes next.\n"
    )


def _numbers_rule() -> str:
    """Čísla a priemery počíta BE - model ich len cituje."""
    return (
        "- NO OWN MATH: never compute averages, ratios or per-week rates yourself. Use the totals in "
        "'reviewed_week_totals' and the numbers given; if a number is not in the context, do not "
        "state it.\n"
        "- EVENT NOTES: 'athlete_note' on an external activity is the athlete's own rule for it. "
        "If it says it cannot be done easily (e.g. 'only full effort'), recommend only doing it "
        "fully or skipping it - never 'half intensity'. Do not quote the note word for word.\n"
        "- LANGUAGE: no English words in non-English text (not 'strength', 'long run', 'easy') - "
        "use the athlete's language. Weekday names are given in it already.\n"
    )


def _templates_rule() -> str:
    """Odporúčania viazané na šablóny - FE z nich spraví tlačidlo Pridať."""
    return (
        "- TEMPLATES: 'templates' lists sessions the athlete can add in one tap ('id: description'). "
        "In suggested_structure set 'action': 'add' = a session to add, 'avoid' = something not "
        "to do, 'info' = context. ONLY for 'add' set 'template' to the matching id (else null) and "
        "'min' to the suggested duration in minutes for one session; 'avoid'/'info' always have "
        "template null. Prefer session types that "
        "exist as templates; one point = one session type; max 6 points. Never write template ids "
        "in 'text'.\n"
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
    "suggested_structure": [{{"text": "short point, e.g. '2x ľahký beh 40-50 min v Z2'", "action": "add" | "avoid" | "info", "template": "template id" | null, "min": 45 | null}}]
  }},
  "health_warning": "max 1 sentence" | null
}}
""".strip()


def _trainer_audience_rule(athlete_name: str) -> str:
    """
    Živý tréner: hodnotenie číta tréner (človek), ktorý plán zverencovi
    poskladal. Píše sa jemu o zverencovi – odborne, bez sľubov za AI.
    """
    who = athlete_name or "the athlete"
    return (
        "AUDIENCE OVERRIDE - READ CAREFULLY:\n"
        f"- The reader is the athlete's human COACH, who built this plan for their athlete ({who}). "
        "Write TO the coach in 2nd person and ABOUT the athlete in 3rd person (use the name or "
        "'zverenec'/'svěřenec'/'your athlete' in the target language, with correct grammatical gender "
        "from the context).\n"
        "- Professional coaching language is fine (zones, load, taper), the coach is an expert.\n"
        "- Every 'the athlete decides' / 'athlete built the plan' above means the COACH here. "
        "Recommendations are for the coach to apply, not for the athlete.\n"
    )


def build_prompts_for_advisor_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
    audience: str = "athlete",
    athlete_name: str = "",
) -> Tuple[str, str]:
    """Zostaví (system_prompt, user_prompt) pre hodnotenie týždňa."""
    settings = settings or {}
    lang_label, second_person = _lang_notes(settings)
    for_trainer = audience == "trainer"
    if for_trainer:
        second_person = "Address the athlete's coach (see AUDIENCE OVERRIDE)."

    plan = context_payload.get("plan") or {}
    state = context_payload.get("athlete_state")
    muscle = context_payload.get("muscle_volume")
    health = context_payload.get("health_records")
    recovery = context_payload.get("recovery")

    system_txt = (
        "You are an experienced endurance coach reviewing a training plan that the ATHLETE built "
        "themselves. You are a mentor, NOT a planner - you never rewrite their plan, you tell them "
        "what works, what does not, and what to do next. "
        "Return a SINGLE valid JSON object. No prose, no code fences."
    )
    if for_trainer:
        system_txt = system_txt.replace(
            "that the ATHLETE built themselves",
            "that the athlete's human COACH built for them - you advise that coach",
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
        "- next_week_guidance: VERBAL recommendations for 'plan.plan_week' (see REVIEW MODE) - session types, "
        "counts, approximate durations and zones, where the long run fits, where rest and strength go. "
        "Do NOT write a day-by-day plan with dates and do NOT present sessions as already scheduled - "
        "the athlete decides. If a muscle group is under its weekly target, say which one to "
        "prioritise, by muscle group name, not by listing exercises.\n"
        "- RACES: if 'goal.races' contains a race within 21 days, that drives everything - say whether "
        "the plan is specific enough and whether the athlete should start tapering.\n"
        + _state_rule(state)
        + _muscle_rule(muscle)
        + _health_rule(health, recovery)
        + _review_quality_rule()
        + _race_week_rule()
        + _numbers_rule()
        + _templates_rule()
        + _format_rules()
        + _proper_names_rule()
         + _events_rule()
        + _terminology_rule(lang_label)
        + "- Tone: experienced mentor - direct, specific, supportive. No generic filler, no praise "
        "that is not backed by the data.\n"
        "- Never invent numbers that are not in the context.\n"
        + (_trainer_audience_rule(athlete_name) if for_trainer else "")
        + "- Return ONLY raw JSON.\n"
    )

    return system_txt, user_txt