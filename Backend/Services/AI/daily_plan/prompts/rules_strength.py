# Services/AI/daily_plan/prompts/rules_strength.py
"""
🌟 PREPÍSANÉ (v4 - deterministická vrstva templates.py + selector.py).

AI už NEVOLÍ cviky, NEPOČÍTA série/opakovania/pauzy ani dĺžku session -
to všetko spravil Services/strength/templates.py + selector.py (vrstva
1+2) v builderi PRED týmto promptom. AI dostáva v
`planning_constraints.strength_sessions_plan` hotové session objekty a
jej JEDINÁ úloha pri strength je:
  1. rozmiestniť ich na dni (viď build_strength_count_rule + rules_schedule),
  2. skopírovať exercise_id/sets/reps/rest_s PRESNE tak, ako sú,
  3. dopísať title + krátke coaching notes (a prípadnú progression cue).

Predošlá verzia (v3) nechávala AI vyberať cviky zo 'strength_ai_menu' a
počítať si dĺžku session sama podľa equipment_mode - presne to
spôsobovalo generické tréningy (bodyweight aj pri full gym vybavení) a
zlé odhady dĺžky (30-35 min namiesto 60) - pôvodný dôvod celého
refaktoru. Táto verzia to už nerobí vôbec.
"""

from __future__ import annotations

from typing import Any, Dict, List


def build_strength_count_rule(session_count: int, endurance_is_primary: bool = True) -> str:
    """
    🌟 PREPÍSANÉ: počet silových je STROP, nie kvóta.

    Predtým prompt hovoril "naplánuj PRESNE N" a AI ich tlačila do týždňa aj
    tam, kde na ne nebol priestor (ťažký drep deň pred prahovým behom, ťažký
    hinge deň pred dlhým behom). Logika athléta je opačná: behať sa dá aj bez
    posilky, pretek bez behu nie. Silové sa preto plánujú až do priestoru,
    ktorý ostane po behoch a externých aktivitách.

    endurance_is_primary=False (athlete nemá beh/bike/plávanie) - posilka JE
    hlavný šport, vtedy sa počet drží.
    """
    if session_count <= 0:
        return (
            "- STRENGTH: No strength sessions planned this week "
            "(`planning_constraints.strength_sessions_plan` is empty). "
            "Do NOT invent any sport='strength' sessions.\n\n"
        )

    if not endurance_is_primary:
        return (
            f"- STRENGTH (PRIMARY SPORT): {session_count} pre-built strength session(s) are "
            "provided in `planning_constraints.strength_sessions_plan`. Strength IS this "
            "athlete's main sport this week, so schedule ALL of them - one per array entry, "
            "each on its own day. Respect the rest-day and two-a-day rules above.\n\n"
        )

    return (
        "- STRENGTH (SUPPORTS THE MAIN SPORT - THE COUNT IS A CEILING, NOT A QUOTA): up to "
        f"{session_count} pre-built strength session(s) are available in "
        "`planning_constraints.strength_sessions_plan`. Use them in the given order (entry 0 "
        "is the most important) and ONLY on days where they do not compromise the main sport "
        f"or recovery. Scheduling FEWER than {session_count} is a CORRECT outcome when the "
        "week is already full - never force them in.\n"
        "  - PRIORITY ORDER when the week is tight: 1) external events (they have fixed "
        "dates), 2) key main-sport sessions (long run, quality/interval/threshold), 3) easy "
        "main-sport volume, 4) strength sessions, 5) rest days - a rest day is NEVER given up "
        "to fit strength in.\n"
        "  - Example: a week with a hard external event, two quality runs and a long run has "
        "room for 1-2 strength sessions, not 3. Drop from the END of the array (keep entry 0).\n"
        "  - If you drop one or more, add one short clause to the `notes` of the strength "
        f"session you DID keep saying why (e.g. only 2 of {session_count} fit because of the "
        "hard external event and two quality runs). Do not create an extra session just to "
        "explain it.\n\n"
    )


def build_strength_structure_rule(
    strength_sessions_plan: List[Dict[str, Any]],
    strength_progression_context: List[Dict[str, Any]],
    lang_label: str,
) -> str:
    """
    Hlavné pravidlo pre vyplnenie `structure.activation` /
    `structure.strength_main_part` / `structure.add_ons` z už hotových
    session objektov. Bez equipment/loaded logiky, bez duration mata -
    to všetko rieši selector.py + schemes.py skôr, než sem prompt
    vôbec dorazí.
    """
    if not strength_sessions_plan:
        return ""

    progression_by_id = {
        p.get("exercise_id"): p
        for p in (strength_progression_context or [])
        if isinstance(p, dict) and p.get("exercise_id")
    }

    lines = [
        "- STRENGTH SESSION DATA (CRITICAL - READ CAREFULLY):",
        "  Each entry in `planning_constraints.strength_sessions_plan` is a COMPLETE, "
        "already-decided strength session - exercise selection, sets, reps, rest and total "
        "duration were computed deterministically BEFORE this prompt. You are NOT choosing "
        "exercises, NOT inventing sets/reps/rest, and NOT estimating duration for these sessions.",
        "  For each entry, when you place it on a day:",
        "  1. Group its `exercises` array by each exercise's `block` field - `block` maps 1:1 "
        "to the JSON schema key: 'activation' -> structure.activation, "
        "'strength_main_part' -> structure.strength_main_part, 'add_ons' -> structure.add_ons.",
        "  2. `reps` is NOT always a rep count: it can be a hold/carry time (\"30-45s\") "
        "or a distance (\"20-30m\") for exercises measured that way (plank, dead hang, "
        "sled). Copy the string VERBATIM either way - never convert a time into reps.\n"
        "  3. For each exercise, output `exercise_id` and copy `sets`, `reps`, `rest_s` "
        "EXACTLY from that exercise's `planned` object - do not change, round, or reinterpret "
        f"these numbers. Add only a short `notes` cue (max 3 words, per schema) - form/tempo/"
        f"breathing cue, in {lang_label}.",
        "  4. Do NOT add exercises that are not in the entry, do NOT drop exercises that are in "
        "it (the deterministic layer already trimmed the session to fit the athlete's target "
        "duration - if it looks short, that is intentional).",
        "  5. Set the session's `duration_min` to that entry's `estimated_total_duration_min` "
        "(use `estimated_core_duration_min` only if `add_ons` ends up empty) - do not calculate "
        "your own estimate.",
        f"  6. Write `title` in {lang_label} reflecting the session's focus (derive it from "
        "`template_name_en` / the dominant pattern in `strength_main_part`, e.g. a squat-focused "
        "session -> something like 'Silový tréning - Nohy'). Do not just translate "
        "`template_name_en` literally if it reads awkwardly.",
        "  7. If `is_deload` is true for an entry, mention briefly in the session `notes` that "
        "this is a lighter/deload week (e.g. 'deload týždeň, ľahšie série') - but still copy the "
        "given sets/reps/rest exactly, they already reflect the deload reduction.",
    ]

    if progression_by_id:
        lines.append(
            "  8. `planning_constraints.strength_progression_context` lists exercises whose "
            "logged history says it is time to progress. For any exercise that appears there, "
            "weave the progression into that exercise's `notes` instead of a generic cue:\n"
            "     - `progression_type: \"weight\"` -> use `suggested_weight_kg` "
            "(e.g. 'skús 72.5 kg'),\n"
            "     - `progression_type: \"reps\"` -> bodyweight exercise, use `suggested_reps` "
            "(e.g. 'skús 15 opakovaní'). NEVER suggest kilograms for these."
        )

    # 🌟 ZMENA: pôvodné pravidlo bolo mäkké ("avoid ... when the week's shape
    # allows") a AI ho v praxi obetovala - ťažký drep deň pred tempom, ťažký
    # RDL deň pred dlhým behom. Teraz je tvrdé, s preferovaným umiestnením
    # (hard days hard: posilka v ten istý deň ako kvalitný beh) a jasným
    # pravidlom, čo robiť, keď sa to nedá (vynechať, nie porušiť).
    lines.append(
        "  8. STRENGTH PLACEMENT (HARD RULE - same priority as REST DAYS): every pre-built "
        "session here contains heavy lower-body work (primary-tier squat/hinge/lunge), so:\n"
        "     - NEVER place a strength session on the day immediately BEFORE: an interval, "
        "tempo or threshold run, a long run, a race, or an external event with intensity "
        "hard. Heavy leg work impairs running economy and quality for the next day.\n"
        "     - PREFERRED: the SAME day as a quality run (run first, strength at least 3 h "
        "later - this uses a two-a-day slot and keeps easy days easy), or the day AFTER a "
        "quality run or long run.\n"
        "     - Keep at least one day between two strength sessions when possible.\n"
        "     - Before finalizing, check every strength session against the NEXT day's "
        "session. If any violates this rule, move it; if no valid day exists, drop it "
        "(see STRENGTH count rule)."
    )

    return "\n".join(lines) + "\n\n"