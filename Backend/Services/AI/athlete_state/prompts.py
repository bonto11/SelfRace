# Services/AI/athlete_state/prompts.py
"""
Prompty pre analýzu stavu športovca.

AI tu hodnotí TRÉNOVANOSŤ - schopnosti, únavu, riziko zranenia, tempá,
odhady časov. Nehodnotí, či je tréningový plán dobre poskladaný; to robí
Services/AI/advisor_review s vlastným promptom.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from Modules.Supabase.auth import AuthCtx
from Services.AI.prefs_defaults import resolve_main_sport


# ============================================================
# HELPERS
# ============================================================

def _remove_empty(d: Any) -> Any:
    """Rekurzívne vymaže None, [], {} — menej tokenov."""
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {
            k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}
        }
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    """Vráti (jazyk_label, pravidlo_oslovovania) podľa nastavení."""
    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def _time_format_rule() -> str:
    """
    Formátovanie akéhokoľvek času/trvania odvodeného zo SEKÚND vo voľnom
    texte - tempá, časy pretekov, splity.
    """
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration or time value "
        "(paces, race time estimates, splits, etc) in free text. Always format as human-readable time: "
        "use 'M:SS' when under an hour (e.g. 319 seconds -> '5:19', 196 seconds -> '3:16'), "
        "and 'H:MM:SS' when an hour or more (e.g. 17813 seconds -> '4:56:53'). "
        "If minutes or hours are zero, omit that unit rather than writing a leading zero segment "
        "(e.g. 45 seconds -> '0:45', not '00:00:45'). "
        "Paces specifically should be written as 'mm:ss/km'.\n"
    )


def _duration_minutes_format_rule() -> str:
    """
    Formátovanie objemu zadaného v MINÚTACH (weekly_minutes_min/max,
    celkový týždenný objem). Odlišné od _time_format_rule(), ktoré rieši
    sekundy.
    """
    return (
        "- VOLUME/DURATION IN MINUTES FORMAT: Never write raw minute values for training volume or duration "
        "in free text (e.g. do NOT write '573 minút'). Always convert to hours and minutes: "
        "use 'H h MM min' format (e.g. 573 minutes -> '9 h 33 min', 90 minutes -> '1 h 30 min'). "
        "Omit the hours part if it is zero (e.g. 45 minutes -> '45 min'), and omit the minutes part "
        "if it is exactly zero (e.g. 120 minutes -> '2 h', not '2 h 0 min').\n"
    )


def _terrain_variability_rule() -> str:
    """
    Zabráni tomu, aby AI zamieňala terénnu variabilitu tempa (kopce, trail)
    so skutočnou únavou alebo rizikom preťaženia.
    """
    return (
        "- TERRAIN-AWARE VARIABILITY: If last_activities/segments show trail or hilly running "
        "(elevation gain, technical/uneven terrain), do NOT interpret the resulting pace or HR "
        "variability (slower uphill, faster downhill, uneven splits) as fatigue or injury risk on its own. "
        "Terrain-driven pace changes are expected and normal. Only raise fatigue_level or injury_risk based on "
        "genuine physiological signals — e.g. elevated HR at easy effort, declining performance across comparable "
        "terrain/conditions over time, poor recovery trends, or explicit subjective signals — not from pace "
        "variability caused by elevation or technical terrain alone.\n"
    )


def _terminology_rule(lang_label: str) -> str:
    """
    Zabráni prenikaniu anglických koučovacích termínov do SK/CS textu
    a zlým prekladom svalových partií.

    Dôvod pre zoznam partií: model preložil 'quads' cez anglické 'pants'
    ako 'nohavice'. Svalové partie sa objavujú v každej analýze sily, takže
    presný preklad musí byť v prompte, nie ponechaný na model.
    """
    if lang_label == "English":
        # V angličtine netreba prekladať, ale partie musia byť pomenované
        # ako partie, nie ako pohybové vzory.
        return (
            "- MUSCLE GROUP NAMING: refer to muscle groups by their plain names - chest, back, "
            "shoulders, biceps, triceps, forearms, core, glutes, quads, hamstrings, calves. Never use "
            "movement-pattern jargon ('vertical pull', 'horizontal push', 'hinge') or internal codes.\n"
        )
    if lang_label == "Czech":
        return (
            "- TERMINOLOGY: Do NOT leave English coaching terms untranslated in free text. Use Czech equivalents, "
            "for example: 'fatigue' -> 'únava', 'hard session(s)' -> 'náročný trénink / náročné tréninky', "
            "'threshold' -> 'práh / prahový', 'recovery' -> 'regenerace', 'base' -> 'základ / základní fáze', "
            "'volume' -> 'objem', 'intensity' -> 'intenzita', 'injury risk' -> 'riziko zranění', 'block' -> 'blok', "
            "'taper' -> 'tapering / odlehčení'. Never mix untranslated English jargon into Czech sentences. "
            "MUSCLE GROUPS translate as: chest -> 'prsa', back -> 'záda', shoulders -> 'ramena', "
            "biceps -> 'biceps', triceps -> 'triceps', forearms -> 'předloktí', core -> 'střed těla / břicho', "
            "glutes -> 'hýždě', quads -> 'přední stehna', hamstrings -> 'zadní stehna', calves -> 'lýtka', "
            "legs -> 'nohy'. NEVER write 'kalhoty' or 'nohavice' - those mean trousers.\n"
        )
    return (
        "- TERMINOLOGY: Do NOT leave English coaching terms untranslated in free text. Use Slovak equivalents, "
        "for example: 'fatigue' -> 'únava', 'hard session(s)' -> 'náročný tréning / náročné tréningy', "
        "'threshold' -> 'prah / prahový', 'recovery' -> 'regenerácia', 'base' -> 'základ / základná fáza', "
        "'volume' -> 'objem', 'intensity' -> 'intenzita', 'injury risk' -> 'riziko zranenia', 'block' -> 'blok', "
        "'taper' -> 'tapering / odľahčenie'. Never mix untranslated English jargon into Slovak sentences. "
        "MUSCLE GROUPS translate as: chest -> 'prsia', back -> 'chrbát', shoulders -> 'ramená', "
        "biceps -> 'biceps', triceps -> 'triceps', forearms -> 'predlaktia', core -> 'stred tela / brucho', "
        "glutes -> 'zadok', quads -> 'predné stehná', hamstrings -> 'zadné stehná', calves -> 'lýtka', "
        "legs -> 'nohy'. NEVER write 'nohavice' - that means trousers.\n"
    )


def _no_raw_technical_values_rule() -> str:
    """
    Zabráni tomu, aby interné boolean hodnoty a názvy polí unikli do
    voľného textu (napr. "zmena z false na true").
    """
    return (
        "- NO RAW TECHNICAL VALUES IN TEXT: Never write literal booleans, field names, or internal codes "
        "in free text (e.g. do NOT write 'true', 'false', 'should_soften', 'zmena z false na true', "
        "'weekly_replan_reason'). Always translate such internal state into a meaningful, human-readable sentence "
        "explaining what actually changed and why it matters to the athlete "
        "(e.g. instead of 'soften_next_days: false -> true', explain that the plan will now be softened over the "
        "next days because of detected fatigue).\n"
    )


def _state_stability_rule(focus: str = "all") -> str:
    """
    Pravidlá z reálnej analýzy: level behu spadol za deň pri rovnakých
    dátach, choroba sa zmenila na fázu "regenerácia" 12 dní pred pretekom,
    poznámka k objemu mala iné čísla než limity a model citoval nezmyselné
    km úseky. Limity aj level navyše strháva kód (main.py).
    """
    volume = (
        # pri sile sa objem neráta v minútach – minúty z prechádzok by advisor
        # bral ako limit tréningu
        "- VOLUME: weekly_minutes_min/max stay null. In volume_tolerance.note describe the weekly "
        "strength volume only with numbers from 'strength_log.weeks' (sessions, work_sets).\n"
        if focus == "strength"
        else "- VOLUME: 'volume_facts' holds the last complete weeks computed in code. Keep "
        "weekly_minutes_min/max within that experience (max at most ~10 % above observed_max; lower "
        "when ill or tapering). In volume_tolerance.note quote 'observed_range_text' exactly as "
        "written and no other minute numbers.\n"
    )
    return (
        volume
        + "- LEVEL STABILITY: 'previous_assessment.levels' are the last levels. Change a level only "
        "with NEW evidence (a new race/best effort, clearly heavier lifts, or a clear volume change over "
        "3+ weeks), at most "
        "0.5 per analysis; same data = same level.\n"
        "- PHASE: illness or injury is a temporary state, NOT a phase - handle it via fatigue, risk "
        "and the text. Within 21 days of a race keep 'race_specific' (taper close to the race); use "
        "'regeneration' only after a race or a long hard block.\n"
        "- HEALTH: 'active_health_issues' are records the athlete logged (illness, injury, "
        "fatigue, menstruation; severity 1-10), 'active' or 'resolved' with days_since_end - factor "
        "them into fatigue and risk and mention them once. Resolved in the last 7 days = the athlete "
        "is returning: say so and keep intensity tolerance conservative. Menstruation and fatigue are normal temporary states, not illness: adjust "
        "fatigue/recovery advice matter-of-factly, never dramatize them.\n"
        "- SPLITS: never quote individual kilometre splits; describe pacing as even or uneven, or "
        "use a min-max given in the context.\n"
    )


def _numbers_consistency_rule() -> str:
    """
    Každé číslo vo voľnom texte musí pochádzať z kontextu a byť rovnaké
    naprieč celou odpoveďou.

    Dôvod: model v jednej analýze napísal "tento týždeň si nabehal len
    21 min" a o vetu ďalej "tento týždeň si na 138 min" - zamenil bežecký
    objem za celkový objem naprieč športmi.
    """
    return (
        "- NUMBERS IN TEXT: every number you write in free text must come from the context JSON and must "
        "be the SAME number everywhere in your answer. Do not mix total training volume with running "
        "volume - 'recent_load' weeks give TOTAL minutes across all sports, so if you want running volume "
        "specifically, derive it from 'last_activities' and say which one you mean. Never state two "
        "different values for the same quantity.\n"
    )


def _race_time_consistency_rule() -> str:
    """
    Odhady časov pretekov si musia navzájom sedieť.

    Dôvod: model vrátil maratón 4:20:00 a polmaratón 2:00:00 naraz - teda
    maratón rýchlejší než dvojnásobok polmaratónu, čo je nemožné. Zároveň
    v texte uvádzal iný 10 km čas než ten, ktorý dal do schémy.
    """
    return (
        "- RACE TIME CONSISTENCY (CHECK BEFORE RETURNING): the estimated race times must be internally "
        "consistent with each other. Each longer distance must be SLOWER per kilometre than the shorter "
        "one, and the total time must grow accordingly. As a sanity check: 10K is roughly 2.07x the 5K "
        "time, half marathon roughly 2.22x the 10K time, and marathon roughly 2.1x the half marathon "
        "time. If your numbers break these relations, recompute them from the single most reliable "
        "recent performance before returning the JSON. Any race time you mention in free text MUST match "
        "the number you put in 'metrics' - never state a different time in prose than in the schema. "
        "The same applies to 'estimated_paces': they must be ordered from slowest (z1) to fastest (z5) "
        "and must be consistent with the race estimates.\n"
    )


def _scope_rule() -> str:
    """
    Athlete state hodnotí STAV, nie plán. Predpisovanie týždňa je práca
    advisor_review, ktorý beží samostatne.
    """
    return (
        "- SCOPE: you assess the athlete's CURRENT STATE, not their training plan. 'suggestions_short' "
        "may name a direction (what is missing, what is at risk, what deserves attention), but do NOT "
        "prescribe a weekly schedule, session counts, specific workouts or which exercises to add - a "
        "separate plan review handles that. Keep every point tied to what the data says about the "
        "athlete's state.\n"
    )


def _recovery_rule() -> str:
    """
    🌟 NOVÉ: HRV a RHR sa čítajú v kontexte, nie len ako čísla.

    Recovery blok nesie okrem čísel aj baseline, denný priebeh za týždeň,
    faktory (alkohol, neskorá káva, ťažké jedlo) a poznámku k noci. Tréner
    rozlišuje "HRV dole po víne" (jednorazové, vysvetlené) od "HRV dole
    tretí deň po sebe bez príčiny" (preťaženie alebo začínajúca choroba).
    Rovnaké pravidlo používa activity_review/prompts.py.
    """
    return (
        "- RECOVERY IN CONTEXT (HRV / RHR / SLEEP):\n"
        "  Never judge recovery from a single number. In the 'recovery' block use:\n"
        "  - 'baseline_hrv_ms' / 'baseline_rhr_bpm': the athlete's usual values (today excluded). A value "
        "is only meaningful relative to their own baseline, never in absolute terms.\n"
        "  - 'recent_days': day-by-day values for the last week ('days_ago' 0 = today). Look for the "
        "pattern - one bad night vs several in a row.\n"
        "  - 'factors' / 'latest_factors': things that disturbed that night - 'alcohol', 'late_caffeine', "
        "'late_food'. 'note' / 'latest_note': the athlete's own words about the night (stress, illness, "
        "late training, travel).\n"
        "  HOW TO INTERPRET:\n"
        "  - A drop WITH a clear cause (alcohol, late food, a stressful day in the note) is an explained, "
        "usually one-off dip. It does NOT on its own justify raising fatigue_level or injury_risk, and it "
        "is not evidence of overtraining - mention the likely cause plainly.\n"
        "  - A drop WITHOUT a cause, especially repeated over 2-3+ days, is a real signal of accumulated "
        "load or an oncoming illness - it SHOULD raise fatigue_level and be named in user_summary.risks.\n"
        "  - A note mentioning illness symptoms (fever, sore throat, feeling unwell) outweighs good "
        "numbers - treat it as a health signal.\n"
        "  - If 'recent_days' show several nights with alcohol, mention the pattern as a recovery risk "
        "rather than treating each night as an isolated event.\n"
        "  - Never invent a cause that is not in the factors or the note.\n"
    )


def _strength_log_rule(strength_log: Optional[Dict[str, Any]], focus: str = "all") -> str:
    """
    Pravidlo pre blok 'strength_log' - reálne odcvičená sila zo
    strength_sessions plus objem na svalové partie.

    AI tu posudzuje, AKO NA TOM athlete je v sile. Čo má robiť ďalej s
    plánom, rieši advisor_review - preto tu nie sú odporúčania typu
    "prioritizuj túto partiu".
    """
    if not strength_log and focus == "endurance":
        return (
            "- STRENGTH: not part of this athlete's focus and no sessions are logged. Set "
            "capabilities.strength to null and do not mention strength or gym work.\n"
        )
    if not strength_log:
        return (
            "- STRENGTH DATA: No logged strength sessions are available. Do NOT claim anything about "
            "the athlete's gym progress, lifted weights, muscle group volume or strength trend, and do NOT "
            "infer them from planned sessions_per_week in prefs. If relevant, you may note in one short "
            "clause that strength work is not being logged yet.\n"
        )

    has_volume = isinstance(strength_log.get("muscle_volume"), dict)
    volume_rule = (
        "- MUSCLE GROUP VOLUME (USE MUSCLE NAMES, NOT MOVEMENT PATTERNS):\n"
        "  'strength_log.muscle_volume.muscles' lists, for this week, each muscle group with "
        "'sets_done' (logged working sets), 'sets_planned' (still scheduled), 'target' (weekly goal) "
        "and 'status' (none/under/on_track/over).\n"
        "  - Always talk in MUSCLE GROUP names the athlete understands - chest, back, shoulders, biceps, "
        "triceps, forearms, core, glutes, quads, hamstrings, calves (translated into the athlete's "
        "language). NEVER use movement-pattern jargon such as 'vertical pull', 'horizontal push', "
        "'hinge' or raw codes like pull_v/push_h - the athlete does not use those terms.\n"
        "  - Use it to judge how balanced their strength work is, with the real numbers "
        "(e.g. 'chrbát máš 8 z 12 sérií, brucho len 2'). Numbers are whole sets - write them as "
        "given. Core above target is never a problem.\n"
        "  - If run_volume_tier is 'high', leg targets are intentionally lower because running already "
        "loads the legs - do not read low leg volume as a weakness in that case.\n"
        if has_volume
        else "- MUSCLE GROUP VOLUME: not available. Do not guess which muscle groups are neglected.\n"
    )

    weeks_rule = (
        "  - 'weeks' = the last complete weeks ('weeks_ago' 1 = last week) with sessions, work_sets "
        "and volume_kg. Use them for consistency (how many weeks in a row they trained) and to spot a "
        "sudden jump in load - clearly more sets than their usual week raises fatigue and injury risk.\n"
        if isinstance(strength_log.get("weeks"), list)
        else ""
    )

    return (
        "- STRENGTH DATA (USE IT): 'strength_log' summarizes what the athlete ACTUALLY lifted "
        "(logged sessions, not the plan). Mention strength explicitly:\n"
        "  - in user_summary.bullets: one short sentence on how strength is going - frequency "
        "(sessions_last_28d, sessions_per_week_avg), volume direction (volume_change_pct_vs_prev_28d) "
        "and the clearest progress from key_lifts.\n"
        "  - in capabilities.strength: base level_1_to_5 and comment on this data, not on guesses.\n"
        "  - key_lifts entries with 'change_kg' are loaded lifts -> talk in kilograms (e.g. 'v drepe si "
        "za 6 týždňov pridal 15 kg'). Entries with 'change_reps' are bodyweight exercises -> talk in "
        "repetitions, NEVER in kilograms.\n"
        + (
            # pri sile je sila hlavný šport – prestávku rieši _focus_rule
            "  - If sessions_last_28d is 0-1, say plainly that training has slowed down.\n"
            if focus == "strength"
            else "  - If days_since_last_session is over 14, or sessions_last_28d is 0-1, say that strength "
            "work has dropped off and what that means for the main sport.\n"
        )
        + "  - Never invent numbers that are not in the block, and never write exercise ids literally - "
        "use a natural name for the movement.\n" + weeks_rule + volume_rule
    )


def _focus_rule(focus: str) -> str:
    """
    Zameranie z úvodného výberu v appke (ui.widgets). PREČO: analýza bola
    písaná pre bežca – kto len posilňuje, dostal level behu 1, odhady časov
    a výčitku, že nebehá; bežec bez záujmu o silu zase rady do posilňovne.
    """
    if focus == "strength":
        return (
            "- TRAINING FOCUS = STRENGTH: the athlete chose strength training (gym or body weight) as "
            "their focus - running is NOT their goal. Assess them as a strength athlete:\n"
            "  - capabilities.strength is the main assessment: frequency and consistency, progress in "
            "key_lifts, loads relative to user.weight_kg when it is known. capabilities.run / ride only "
            "when last_activities contain such activities, otherwise null. Never criticise missing "
            "running, long runs or endurance volume.\n"
            "  - fatigue_level and injury_risk come from strength load first: sessions close together, a "
            "jump in weekly sets (strength_log.weeks, volume_change_pct_vs_prev_28d), the same muscle "
            "groups without rest, recovery signals and health records. Walks or rides in recent_load add "
            "a little load, they are not the main signal.\n"
            "  - intensity_tolerance.hard_sessions_per_week_max = demanding (heavy or high-volume) strength "
            "sessions per week they handle now; the comment is about recovery between them.\n"
            "  - suggested_block_kind: 'strength_base' (technique and regularity - beginners, returning "
            "after a break), 'strength_build' (progressive overload when they train regularly), "
            "'regeneration' (deload after a long hard block, high fatigue or illness).\n"
            "  - metrics and estimated_paces are null - no VO2max, race times or paces.\n"
            "  - A break (days_since_last_session over 14) is not a failure: keep the level unless it is "
            "longer than ~6 weeks, and say the first sessions back should be lighter.\n"
        )
    if focus == "endurance":
        return (
            "- TRAINING FOCUS = RUNNING & TRAIL: the athlete chose running/trail and does not want gym "
            "advice. Never suggest adding strength training. If strength_log is present, mention it in "
            "at most one short clause.\n"
        )
    if focus == "hybrid":
        return (
            "- TRAINING FOCUS = RUNNING + STRENGTH: the athlete wants both. Assess run and strength "
            "equally and judge whether strength sessions and hard runs leave enough recovery between "
            "them (heavy legs right before a key run is a risk).\n"
        )
    if focus == "ocr":
        return (
            "- TRAINING FOCUS = OCR / HYROX: obstacle races and Hyrox need running AND strength "
            "endurance - grip and pulling (hangs, pull-ups), carries, lunges, pushing and moving on "
            "varied terrain. Assess both capabilities.run and capabilities.strength and say in the text "
            "how ready the athlete is for this mix (e.g. a strong runner with little grip work). Road race "
            "estimates stay as a running benchmark.\n"
        )
    if focus == "health":
        return (
            "- TRAINING FOCUS = HEALTH: the athlete trains for health, not performance. Write in plain "
            "everyday language without coaching jargon (no zones, thresholds, VO2max or block names in "
            "the text). Focus on regular movement, consistency, recovery and how they feel - light "
            "cardio and light strength both count, never push progression or performance. Race "
            "estimates and paces may stay in the schema, but never build the text around them.\n"
        )
    return ""


PB_VALID_DAYS = 180  # hranica "aktuálny" vs "potenciál" pre osobné rekordy


def _pb_validity_rule() -> str:
    """
    Ako pracovať s bests označenými is_expired=true (staršie než
    PB_VALID_DAYS) - sú signálom dlhodobého potenciálu, nie aktuálneho stavu.
    """
    return (
        "- PERSONAL BEST VALIDITY: Each entry in 'bests' has 'days_ago' and 'is_expired'. "
        "Entries with is_expired=true are OLD (over 180 days) and must NOT be treated as the athlete's "
        "current ability or used to calibrate current paces/capability level. Treat them only as evidence "
        "of long-term potential/ceiling — if you reference one in free text, explicitly mention its age "
        "(e.g. 'pred X mesiacmi si dosiahol...') and frame it as past potential, never as a current state. "
        "Only entries with is_expired=false represent current fitness and may be used for calibration.\n"
    )


def _days_until(date_str: Optional[str]) -> Optional[int]:
    """Počet dní do dátumu od dnes."""
    if not date_str:
        return None
    try:
        target = date.fromisoformat(str(date_str)[:10])
        return (target - date.today()).days
    except Exception:  # noqa: BLE001
        return None


# ============================================================
# MINIFIKÁCIA KONTEXTU
# ============================================================

def minify_analyze_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva analyze context pred odoslaním do AI:
    - latest_paces: odstráni DB metadata (id, user_id, measured_at)
    - external_events: posiela len ak má reálne eventy
    - recent_load: max 4 týždne
    - bests: pridá is_expired, zahodí záznamy staršie než rok
    - prefs.targets: odstráni sporty mimo main/add_on_sports
    - races: pridá days_until_race
    - last_activities: max 10, bez interných ID
    - strength_log: prechádza bez zmeny, builder ho už posiela zhustený
    """
    if not isinstance(context, dict):
        return {}
    out: Dict[str, Any] = json.loads(json.dumps(context, default=str))

    # --- User — odstráni interné polia ---
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email", "name"):
            u.pop(k, None)

    # --- Prefs — odstráni external_activities, nerelevantné sporty ---
    prefs = out.get("prefs")
    if isinstance(prefs, dict):
        pv = prefs.get("value")
        if isinstance(pv, dict):
            pv.pop("external_activities", None)
        prefs.pop("external_activities", None)

        main_sport = prefs.get("main_sport") or ""
        add_on = prefs.get("add_on_sports") or []
        allowed_sports = {main_sport.lower()} | {
            s.lower() for s in add_on if isinstance(s, str)
        }

        targets = prefs.get("targets")
        if isinstance(targets, dict):
            cleaned_targets: Dict[str, Any] = {}
            for sport_key, sport_val in targets.items():
                if sport_key not in ("strength",) and sport_key not in allowed_sports:
                    continue
                if not isinstance(sport_val, dict):
                    continue

                races = sport_val.get("races")
                if isinstance(races, list):
                    minified_races = []
                    for r in races:
                        if not isinstance(r, dict):
                            continue
                        race_date = r.get("date") or r.get("start_date")
                        minified_races.append(
                            {
                                "name": r.get("name"),
                                "date": race_date,
                                "days_until_race": _days_until(race_date),
                                "race_goal": r.get("race_goal"),
                                "race_type": r.get("race_type"),
                                "target_time": r.get("target_time"),
                                "custom_distance_km": r.get("custom_distance_km"),
                                "elevation_gain_m": r.get("elevation_gain_m"),
                                "terrain": r.get("terrain"),
                                "priority": r.get("priority"),
                            }
                        )
                    sport_val = dict(sport_val)
                    sport_val["races"] = minified_races

                cleaned_targets[sport_key] = sport_val
            prefs["targets"] = cleaned_targets

    # --- Streamy, laps, splits nepatria sem ---
    for k in ("streams", "laps", "splits"):
        out.pop(k, None)

    # --- recent_load — max 4 týždne ---
    recent_load = out.get("recent_load")
    if isinstance(recent_load, dict):
        weeks = recent_load.get("weeks")
        if isinstance(weeks, list):
            recent_load["weeks"] = [
                w
                for w in weeks
                if isinstance(w, dict) and int(w.get("week_index_from_now", -99)) >= -4
            ]

    # --- bests — is_expired flag namiesto tvrdého orezania na 180 dní ---
    # POZOR: chýbajúci "days_ago" sa NESMIE brať ako 0 (dnes) — to bol bug,
    # kvôli ktorému staré rekordy bez days_ago prešli ako čerstvé. Chýbajúci
    # údaj = neznámy vek = fail-safe označiť ako expired.
    bests = out.get("bests")
    if isinstance(bests, dict):
        for sport_key, items in bests.items():
            if not isinstance(items, list):
                continue
            cleaned_items: List[Dict[str, Any]] = []
            for b in items:
                if not isinstance(b, dict):
                    continue
                raw_days_ago = b.get("days_ago")
                if raw_days_ago is None:
                    days_ago = None
                else:
                    try:
                        days_ago = int(raw_days_ago)
                    except (TypeError, ValueError):
                        days_ago = None
                is_expired = days_ago is None or days_ago > PB_VALID_DAYS
                # extrémne staré (>365 dní) nedávajú zmysel ani ako "potenciál"
                if days_ago is not None and days_ago > 365:
                    continue
                b2 = dict(b)
                b2["days_ago"] = days_ago
                b2["is_expired"] = is_expired
                cleaned_items.append(b2)
            bests[sport_key] = cleaned_items

    # --- latest_paces — odstráni DB metadata ---
    paces = out.get("latest_paces")
    if isinstance(paces, dict):
        out["latest_paces"] = {
            k: v for k, v in paces.items() if k not in ("id", "user_id", "measured_at")
        }

    # --- external_events — posiela len ak má reálne eventy ---
    ext = out.get("external_events")
    if isinstance(ext, dict):
        events = ext.get("events")
        if not events:
            win = ext.get("window")
            if isinstance(win, dict):
                events = win.get("events")
        if not events:
            out.pop("external_events", None)

    # --- last_activities — max 10, bez interných ID ---
    la = out.get("last_activities")
    if isinstance(la, list):
        cleaned: List[Dict[str, Any]] = []
        for it in la:
            if not isinstance(it, dict):
                continue
            it2 = dict(it)
            it2.pop("activity_id", None)
            it2.pop("name", None)
            cleaned.append(it2)
            if len(cleaned) >= 10:
                break
        out["last_activities"] = cleaned

    # --- user_settings — len relevantné polia ---
    us = out.get("user_settings")
    if isinstance(us, dict):
        out["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }

    return _remove_empty(out)


def _minify_state_for_progress(state: dict) -> dict:
    """Pre progress report potrebujeme len ai_state a user_summary."""
    if not isinstance(state, dict):
        return {}
    return _remove_empty(
        {
            "ai_state": state.get("ai_state"),
            "user_summary": state.get("user_summary"),
        }
    )


# ============================================================
# PROMPTS: ANALYZE
# ============================================================

def build_prompts_for_analyze(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre analýzu stavu športovca.
    Detekuje detraining a beginner stav a prispôsobí inštrukcie.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    context2 = dict(context_payload) if isinstance(context_payload, dict) else {}
    context2["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }
    context_for_llm = minify_analyze_context_for_ai(context2)

    prefs = context_for_llm.get("prefs") or {}
    prefs2 = prefs.get("value", prefs) if isinstance(prefs, dict) else {}
    weeks = int(prefs2.get("weeks") or 4)
    main_sport = resolve_main_sport(prefs2)
    is_beginner = bool(context_for_llm.get("is_returning_beginner"))
    focus = str(context_for_llm.get("training_focus") or "all")
    # len sila: bez behu sa nehodnotia tempá, časy, prahy ani detraining
    lifts_only = focus == "strength"

    thresholds = context_for_llm.get("thresholds") or {}
    run_thresh = thresholds.get("run") or {}
    lthr = run_thresh.get("lthr_bpm")
    lthr_rule = (
        f"- THRESHOLD RULE: LTHR = {lthr} bpm = Z4/Z5 boundary. "
        "Threshold/Prahový sessions target Z4. NEVER prescribe Z3 for threshold sessions.\n"
        if lthr and not lifts_only
        else ""
    )

    targets = prefs2.get("targets") or {}
    run_target = targets.get("run") or {}
    races = run_target.get("races") or []
    next_race = min(
        (
            r
            for r in races
            if isinstance(r, dict)
            and r.get("days_until_race") is not None
            and r["days_until_race"] >= 0
        ),
        key=lambda r: r["days_until_race"],
        default=None,
    )
    race_hint = (
        f"- NEXT RACE: {next_race.get('name')} in {next_race.get('days_until_race')} days "
        f"({next_race.get('custom_distance_km')} km, {next_race.get('elevation_gain_m')} m elev). "
        "Factor this into block recommendation and fatigue management.\n"
        if next_race and not lifts_only
        else ""
    )

    last_acts = context_for_llm.get("last_activities") or []
    detraining_hint = (
        "" if lifts_only else _build_detraining_hint(_get_days_since_last_run(last_acts))
    )

    strength_rule = _strength_log_rule(context_for_llm.get("strength_log"), focus)

    if not is_beginner:
        beginner_hint = ""
    elif lifts_only:
        beginner_hint = (
            "- NO LOGGED STRENGTH SESSIONS YET: assign capabilities.strength.level_1_to_5 = 1 and say "
            "that the assessment will get precise once they log a few sessions.\n"
        )
    else:
        beginner_hint = (
            "- USER IS DETECTED AS BEGINNER/RETURNING. Assign capabilities.run.level_1_to_5 = 1.\n"
        )

    if lifts_only:
        system_txt = (
            "You are a strength training coaching assistant for people who train in the gym or with "
            "their body weight. You receive structured JSON about an athlete. "
            "Your task is to analyze the current training state and return a SINGLE valid JSON object. "
            "Do NOT output prose or code fences, only JSON."
        )
        sport_line = "The training focus is STRENGTH (gym / body weight training).\n"
        load_line = (
            "- Use strength_log first, then recovery, active_health_issues, recent_load and "
            "last_activities (other activities) for fatigue/injury risk.\n"
        )
        run_rules = ""
        paces_block = ""
    else:
        system_txt = (
            "You are an endurance coaching assistant for runners and multisport athletes. "
            "You receive structured JSON about an athlete. "
            "Your task is to analyze the current training state and return a SINGLE valid JSON object. "
            "Do NOT output prose or code fences, only JSON."
        )
        sport_line = f"The main sport is: {main_sport}.\n"
        load_line = (
            "- Use recent_load, recovery, external_events and last_activities for fatigue/injury risk.\n"
            "- SEGMENTS: If 'segments' are present in last_activities, use them to assess pacing "
            "consistency and capability.\n"
        )
        run_rules = (
            _time_format_rule()
            + _race_time_consistency_rule()
            + _terrain_variability_rule()
            + _pb_validity_rule()
        )
        paces_block = (
            "\nCRITICAL INSTRUCTIONS FOR 'estimated_paces':\n"
            "1. NO RUNS = NO UPDATE (UNLESS DETRAINING).\n"
            "2. DO NOT USE OVERALL AVG PACE FOR INTERVALS.\n"
            "3. EVALUATE SEGMENTS: Use distance, pace and HR to judge capability.\n"
            "4. EVOLUTION, NOT REVOLUTION.\n"
            "5. REALITY CHECK: Z1 pace should never exceed 7:30 min/km if 5K is < 25 min.\n"
        )

    schema_text = _analyze_schema(lang_label, focus)

    user_txt = (
        f"Analyze the athlete context JSON and fill the schema.\n"
        + sport_line
        + f"The upcoming horizon is about {weeks} weeks.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema.\n"
        "- NO PARROTING: Do NOT output acute_load_score or chronic_load_score in the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        + load_line
        + _focus_rule(focus)
        + _scope_rule()
        + _duration_minutes_format_rule()
        + _numbers_consistency_rule()
        + _state_stability_rule(focus)
        + _terminology_rule(lang_label)
        + _no_raw_technical_values_rule()
        + _recovery_rule()
        + run_rules
        + strength_rule
        + lthr_rule
        + race_hint
        + beginner_hint
        + detraining_hint
        + paces_block
    )

    return system_txt, user_txt


# ============================================================
# PROMPTS: PROGRESS
# ============================================================

def build_prompts_for_progress(
    previous_state: dict,
    current_state: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre progress porovnanie dvoch
    stavov. Posiela len ai_state a user_summary — nie celý kontext.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)
    # zameranie ukladá main.py do analýzy – porovnanie hovorí tou istou rečou
    focus = str((current_state or {}).get("training_focus") or "all")

    if focus == "strength":
        strength_line = (
            "- STRENGTH FOCUS: the athlete trains strength, running is not their goal. Compare "
            "capabilities.strength, fatigue, risk and the strength volume note; never mention running, "
            "paces, VO2max or race times. If a specific muscle group is consistently neglected across "
            "both states, name it (chest, back, core...) in risks_to_watch. Use muscle group names, never "
            "movement-pattern jargon.\n"
        )
        vo2_line = "- vo2max = null.\n"
    elif focus == "endurance":
        strength_line = (
            "- STRENGTH: not part of this athlete's focus - do not comment on strength or gym work.\n"
        )
        vo2_line = "- If possible, extract and compare estimated_vo2max from metrics.\n"
    else:
        strength_line = (
            "- STRENGTH: capabilities.strength in both states is based on logged gym sessions and on "
            "weekly volume per MUSCLE GROUP. If it changed, say in one clause how strength is developing "
            "alongside the main sport - and if a specific muscle group is consistently neglected across "
            "both states, name it (chest, back, core...) in risks_to_watch. Use muscle group names, never "
            "movement-pattern jargon. If nothing changed, do not invent strength progress.\n"
        )
        vo2_line = "- If possible, extract and compare estimated_vo2max from metrics.\n"
    plain_line = (
        "- Plain everyday language without coaching jargon - the athlete trains for health.\n"
        if focus == "health"
        else ""
    )

    context_for_llm = {
        "previous_state": _minify_state_for_progress(previous_state),
        "current_state": _minify_state_for_progress(current_state),
        "user_settings": {
            "language": settings.get("language"),
            "timezone": settings.get("timezone"),
        },
    }

    system_txt = (
        f"You are {'a strength training' if focus == 'strength' else 'an endurance'} coaching "
        "assistant that compares two athlete state JSON objects. "
        "Return a SINGLE valid JSON object describing meaningful changes. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = _progress_schema(lang_label)

    user_txt = (
        "Compare previous_state vs current_state and fill the schema.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- NO PARROTING. Do NOT parrot back fields if they haven't changed meaningfully.\n"
        "- Always return exactly one JSON object matching the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        "- Keep string arrays short and impactful.\n"
        # Progress NEPOČÍTA nové odhady - len porovnáva dva hotové stavy.
        # Keby si ich prepočítal, dostal by athlete dve rôzne čísla pre to
        # isté v rovnakej obrazovke.
        "- NO RECOMPUTING: both states are already finished analyses. Report the values AS THEY ARE in "
        "the JSON - never recalculate race times, paces or VO2max, and never state a value that is not "
        "in either state. If a value is missing in one of the states, say it was not available rather "
        "than estimating it.\n"
        "- COMPARE, DO NOT PRESCRIBE: describe what changed and what to watch. Do not write a training "
        "plan, session counts or a weekly schedule - a separate plan review handles that.\n"
        + _time_format_rule()
        + _duration_minutes_format_rule()
        + _numbers_consistency_rule()
        + _terminology_rule(lang_label)
        + _no_raw_technical_values_rule()
        + _terrain_variability_rule()
        + strength_line
        + vo2_line
        + plain_line
    )

    return system_txt, user_txt


# ============================================================
# SCHEMAS
# ============================================================

_CAPABILITY = (
    '{{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", '
    '"comment": "max 1 sentence{note}" }}'
)


def _analyze_schema(lang_label: str, focus: str = "all") -> str:
    """JSON schéma pre analýzu stavu športovca – podľa zamerania."""
    cap = lambda note="": _CAPABILITY.format(note=note)  # noqa: E731

    if focus == "strength":
        capabilities = (
            f'      "strength": {cap(", based on strength_log")},\n'
            f'      "run":      {cap()} | null (only when last_activities contain runs),\n'
            f'      "ride":     {cap()} | null (only when last_activities contain rides)'
        )
        volume = (
            '{ "weekly_minutes_min": null, "weekly_minutes_max": null, '
            '"note": "max 1 sentence on the weekly strength volume they handle (sessions, working sets)" }'
        )
        intensity = (
            '{ "hard_sessions_per_week_max": number | null, '
            '"comment": "max 1 sentence - demanding strength sessions per week and recovery between them" }'
        )
        block = '"strength_base" | "strength_build" | "regeneration"'
        metrics = "null"
        paces = "null"
    else:
        strength_note = (
            ", only when strength_log is present"
            if focus == "endurance"
            else ", based on strength_log if present"
        )
        capabilities = (
            f'      "run":      {cap()},\n'
            f'      "ride":     {cap()} | null,\n'
            f'      "strength": {cap(strength_note)} | null'
        )
        volume = (
            '{ "weekly_minutes_min": number | null, "weekly_minutes_max": number | null, '
            '"note": "max 1 sentence" }'
        )
        intensity = '{ "hard_sessions_per_week_max": number | null, "comment": "max 1 sentence" }'
        block = (
            '"base_aerobic" | "base_long" | "threshold_speed" | "regeneration" | "race_specific" | string'
        )
        metrics = """{
      "estimated_vo2max": number | null,
      "estimated_5k_time_s": number | null,
      "estimated_10k_time_s": number | null,
      "estimated_half_marathon_time_s": number | null,
      "estimated_marathon_time_s": number | null
    }"""
        paces = """{
      "z1_pace_s": number | null,
      "z2_pace_s": number | null,
      "z3_pace_s": number | null,
      "z4_pace_s": number | null,
      "z5_pace_s": number | null,
      "best_1k_s": number | null
    }"""

    return f"""
{{
  "user_summary": {{
    "headline": "1 punchy sentence in {lang_label}, 2nd person",
    "bullets": ["max 3 short points"],
    "risks": ["max 2 short points"],
    "suggestions_short": ["max 3 short points"]
  }},
  "ai_state": {{
    "capabilities": {{
{capabilities}
    }},
    "fatigue_level": "low" | "moderate" | "high",
    "injury_risk": "low" | "moderate" | "high",
    "volume_tolerance": {volume},
    "intensity_tolerance": {intensity},
    "suggested_block_kind": {block},
    "metrics": {metrics},
    "estimated_paces": {paces},
    "plan_adjustment": {{
      "soften_next_days": {{ "should_soften": boolean, "days": number | null, "reason": "max 1 sentence" }},
      "should_replan_weekly": boolean,
      "weekly_replan_reason": "max 1 sentence" | null
    }}
  }}
}}
""".strip()


def _progress_schema(lang_label: str) -> str:
    """JSON schéma pre progress porovnanie."""
    return f"""
{{
  "summary": {{
    "headline": "1 short punchy sentence in {lang_label}, 2nd person",
    "bullets": ["max 3 short points"]
  }},
  "comparisons": {{
    "fatigue_level": {{ "previous": "low"|"moderate"|"high"|null, "current": "low"|"moderate"|"high"|null, "comment": "max 1 sentence" }},
    "injury_risk": {{ "previous": "low"|"moderate"|"high"|null, "current": "low"|"moderate"|"high"|null, "comment": "max 1 sentence" }},
    "block_kind": {{ "previous": string|null, "current": string|null, "comment": "max 1 sentence" }},
    "vo2max": {{ "previous": number|null, "current": number|null, "comment": "max 1 sentence" }} | null,
    "volume_tolerance": {{
      "previous_weekly_minutes_min": number|null, "previous_weekly_minutes_max": number|null,
      "current_weekly_minutes_min": number|null, "current_weekly_minutes_max": number|null,
      "comment": "max 1 sentence"
    }},
    "plan_adjustment": {{ "soften_change": string|null, "weekly_replan_change": string|null }}
  }},
  "recommendations": {{
    "celebrations": ["max 2 short points"],
    "risks_to_watch": ["max 2 short points"],
    "focus_next_weeks": ["max 2 short points"]
  }}
}}
""".strip()


# ============================================================
# DETRAINING DETECTION
# ============================================================

def _get_days_since_last_run(last_acts: List[Dict[str, Any]]) -> int:
    """Počet dní od posledného behu z last_activities bloku."""
    for a in last_acts:
        if not isinstance(a, dict) or a.get("sport") != "run":
            continue
        date_label = str(a.get("date", ""))
        if date_label == "today":
            return 0
        if date_label.startswith("today-"):
            try:
                return int(date_label.split("-")[1])
            except ValueError:
                pass
    return 999


def _build_detraining_hint(days_since_last_run: int) -> str:
    """Inštrukcia pre AI podľa počtu dní bez behu."""
    if days_since_last_run <= 0:
        return ""
    if days_since_last_run <= 10:
        return (
            "\n- RECOVERY/DELOAD DETECTED: Fitness is maintained. "
            "Do NOT degrade paces or race estimates.\n"
        )
    if days_since_last_run <= 21:
        return (
            "\n- MILD DETRAINING DETECTED: Slightly degrade intensive paces (Z4, Z5) "
            "by 2-5 sec/km and add some time to race estimates.\n"
        )
    return (
        "\n- SIGNIFICANT DETRAINING DETECTED: Noticeable loss of fitness. "
        "Degrade all paces by 10-20 sec/km, significantly increase race estimates, "
        "and lower VO2max.\n"
    )