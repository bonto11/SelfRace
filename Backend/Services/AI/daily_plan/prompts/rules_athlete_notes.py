# Services/AI/daily_plan/prompts/rules_athlete_notes.py
"""
Pravidlá naviazané na TOHTO KONKRÉTNEHO athléta - jeho skúsenostná
úroveň (beginner protocol) a priame inštrukcie, ktoré nechal cez coach
notes (sticky - platné pre každý plán, ephemeral - len na tento
týždeň). build_athlete_instructions_rule má najvyššiu prioritu
spomedzi všetkých pravidiel v promptu - zámerne sa vkladá do user_txt
hneď na začiatok, pred DATE INTEGRITY aj default sport/rest logiku.
"""

from __future__ import annotations

from typing import List, Optional


def build_beginner_rule(is_returning_beginner: bool) -> str:
    if not is_returning_beginner:
        return ""
    return (
        "- BEGINNER / RETURNING ATHLETE PROTOCOL (CRITICAL):\n"
        "  - Explain intensity using human feeling (Talk Test, Sing Test).\n"
        "  - Emphasize: 'Walking during a run is success, not failure.'\n"
        "  - FOR BIKE: 'Cadence over Power'.\n\n"
    )


def build_athlete_instructions_rule(
    sticky_notes: List[str], ephemeral_note: Optional[str]
) -> str:
    """
    ATHLETE INSTRUCTIONS (sticky + ephemeral notes) — najvyššia priorita,
    explicitne nadraďuje default main_sport/ALLOWED SPORTS/LONG RUN pravidlá.

    FIX HISTÓRIA (zachované z pôvodného monolitického prompts.py):
    1) Táto sekcia sa predtým vypočítala, ale nikdy sa nepridala do
       finálneho promptu (chýbajúce "+ notes_rule" pri skladaní user_txt).
    2) Po oprave #1 stále prehrávala proti dvom NEPODMIENENÝM pravidlám
       (long_run_rule vždy pridalo 1 long run pre main_sport;
       sports_restriction vždy explicitne vypísalo main_sport ako
       "ALLOWED") — model mal teda dve protirečiace si inštrukcie.
       long_run_rule, multi_sport_rule aj sports_restriction (v
       rules_endurance.py / rules_schedule.py) sú preto podmienené a
       explicitne odkazujú späť na ATHLETE INSTRUCTIONS, takže si už
       neprotirečia.
    """
    if not sticky_notes and not ephemeral_note:
        return ""

    lines = [
        "--- ATHLETE INSTRUCTIONS (HIGHEST PRIORITY — OVERRIDES EVERYTHING BELOW) ---",
        "The athlete has left direct instructions below. These OVERRIDE the default "
        "main_sport, ALLOWED SPORTS, LONG RUN, and MULTI-SPORT rules that follow later "
        "in this prompt, even though those rules will mention the athlete's usual main "
        "sport by name (e.g. 'Main Sport: run'). A label further down saying a sport is "
        "the 'main sport' or 'allowed' does NOT cancel an exclusion stated here.",
        "",
        "CRITICAL ENFORCEMENT RULES:",
        "1. If an instruction restricts or excludes a sport (e.g. 'no running this week', "
        "'skip cycling', 'chcem pokoj od behania'), you MUST NOT schedule ANY session for "
        "that sport this week — including long runs, easy runs, or recovery runs — even "
        "though it is listed as the athlete's main_sport elsewhere in this prompt.",
        "2. It is ALWAYS better to schedule FEWER sessions (or more rest days, or more of "
        "an allowed sport like strength) than to violate an athlete instruction. Do not "
        "'fill the gap' with the restricted sport just to hit a volume or session-count "
        "target, and do not treat the excluded sport's usual weekly minutes as something "
        "that must be replaced 1:1 by another sport.",
        "3. If you add an alternative activity that is not strictly required to replace the "
        "restricted sport (e.g. a light walk), it MUST be clearly marked as optional in "
        "`notes` (e.g. 'Voliteľná prechádzka, ak sa cítiš na to' / 'Optional, only if you feel like it').",
        "4. If the instruction leaves only one sport realistically available (e.g. only "
        "strength remains after excluding running and the athlete does not cycle/swim), "
        "plan ONLY that sport plus rest days — do not invent sessions for other sports to "
        "compensate, and it is fine for the week to have fewer total sessions than usual.",
        "5. Exception — safety ceiling: if an instruction requests something excessive or "
        "unsafe (e.g. running a marathon distance every day, zero rest days for weeks), "
        "do NOT follow it literally. Instead, honor its clear underlying intent (more of "
        "that sport / higher priority for it) within safe volume and recovery limits from "
        "`athlete_state.ai_state.volume_tolerance`, and briefly note in `notes` why it was "
        "moderated. This exception applies ONLY to unsafe volume/intensity requests — it "
        "does NOT apply to requests to REDUCE or EXCLUDE a sport (rule 1 always applies in full).",
        "",
    ]
    if sticky_notes:
        lines.append("Permanent (every plan):")
        for i, n in enumerate(sticky_notes, 1):
            lines.append(f"  {i}. {n}")
    if ephemeral_note:
        lines.append(f"\nOne-time instruction for THIS week only:\n  → {ephemeral_note}")
    return "\n".join(lines) + "\n\n"
