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


def build_strength_count_rule(session_count: int) -> str:
    """
    Nahrádza pôvodné "STRENGTH: Target Nx per week". Cieľový počet už nie
    je číslo, ktoré má AI dodržať pri PLÁNOVANÍ obsahu - je to presný
    počet HOTOVÝCH session objektov v
    `planning_constraints.strength_sessions_plan`, ktoré treba len
    rozmiestniť na dni. AI už nerozhoduje KOĽKO strength sessions má byť
    ani ČO v nich je.
    """
    if session_count <= 0:
        return (
            "- STRENGTH: No strength sessions planned this week "
            "(`planning_constraints.strength_sessions_plan` is empty). "
            "Do NOT invent any sport='strength' sessions.\n\n"
        )
    return (
        f"- STRENGTH: Exactly {session_count} pre-built strength session(s) are provided in "
        "`planning_constraints.strength_sessions_plan` (see STRENGTH SESSION DATA rule below "
        "for how to use them). Schedule EXACTLY this many sport='strength' sessions this week - "
        "one per array entry, each on its own day. Do NOT add extra strength sessions and do NOT "
        "drop any. If days are tight, reduce OTHER sports before dropping a strength session, but "
        "never violate the rest-day/two-a-day rules above to fit them.\n\n"
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
        "  2. For each exercise, output `exercise_id` and copy `sets`, `reps`, `rest_s` "
        "EXACTLY from that exercise's `planned` object - do not change, round, or reinterpret "
        f"these numbers. Add only a short `notes` cue (max 3 words, per schema) - form/tempo/"
        f"breathing cue, in {lang_label}.",
        "  3. Do NOT add exercises that are not in the entry, do NOT drop exercises that are in "
        "it (the deterministic layer already trimmed the session to fit the athlete's target "
        "duration - if it looks short, that is intentional).",
        "  4. Set the session's `duration_min` to that entry's `estimated_total_duration_min` "
        "(use `estimated_core_duration_min` only if `add_ons` ends up empty) - do not calculate "
        "your own estimate.",
        f"  5. Write `title` in {lang_label} reflecting the session's focus (derive it from "
        "`template_name_en` / the dominant pattern in `strength_main_part`, e.g. a squat-focused "
        "session -> something like 'Silový tréning - Nohy'). Do not just translate "
        "`template_name_en` literally if it reads awkwardly.",
        "  6. If `is_deload` is true for an entry, mention briefly in the session `notes` that "
        "this is a lighter/deload week (e.g. 'deload týždeň, ľahšie série') - but still copy the "
        "given sets/reps/rest exactly, they already reflect the deload reduction.",
    ]

    if progression_by_id:
        lines.append(
            "  7. `planning_constraints.strength_progression_context` lists exercises where the "
            "athlete's logged history suggests a weight change. For any exercise whose "
            "`exercise_id` appears there with `should_progress: true`, weave `suggested_weight_kg` "
            f"into that exercise's `notes` as a short cue (e.g. 'skús 72.5 kg') instead of a "
            "generic cue. Ignore entries with `should_progress: false` - do not mention weight "
            "for those."
        )

    lines.append(
        "  8. PLACEMENT: if a session's `strength_main_part` is dominated by squat/hinge/lunge/"
        "calf patterns at primary or secondary tier (heavy, loaded lower-body work), avoid "
        "scheduling it on the day immediately before a long run or a hard/interval running "
        "session - eccentric muscle damage from heavy leg work can impair running economy for "
        "up to 8 hours. Prefer the day after a quality run, or at least a rest/easy day between "
        "them, when the week's shape allows it."
    )

    return "\n".join(lines) + "\n\n"
