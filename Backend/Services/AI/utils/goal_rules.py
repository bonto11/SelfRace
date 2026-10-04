# Services/AI/utils/goal_rules.py
"""
Pravidlo pre AI podľa hlavného cieľa usera (prefs.goal_kind).

PREČO: goal_kind sa do promptu posielal len ako surová hodnota a AI si ju
vykladala sama. Pre laika s cieľom "schudnúť" potom vznikali výkonnostné
plány s intervalmi a odborným jazykom. Tu je pre každý cieľ jasne povedané,
ako má plán vyzerať a akým jazykom má AI písať.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

# Ciele pre ľudí, ktorí nešportujú kvôli výkonu - jednoduchý jazyk, bez žargónu.
CASUAL_GOALS = {"lose_weight", "health"}

_GOAL_TEXT: Dict[str, str] = {
    "lose_weight": (
        "- PRIMARY GOAL: WEIGHT LOSS / feeling better in their body - NOT performance.\n"
        "  - Consistency beats intensity: 4-5 active days, mostly EASY aerobic work "
        "(conversational pace, Z1-Z2). Grow session length slowly, about 10% per week.\n"
        "  - Include strength 2x per week when strength is allowed - it helps keep muscle while losing fat.\n"
        "  - At most 1 moderate session per week. No hard intervals in the first 3 weeks.\n"
        "  - Walking or easy run-walk is a valid session for a beginner.\n"
        "  - Never mention calories, diets or body weight numbers.\n"
    ),
    "health": (
        "- PRIMARY GOAL: HEALTH and general fitness - NOT performance.\n"
        "  - 3-4 active days, mostly easy aerobic work, plus strength 2x per week when allowed.\n"
        "  - At most 1 moderate, playful session per week (e.g. a few short pickups). No hard intervals.\n"
        "  - Leave at least 2 rest days. Enjoyment and habit matter more than numbers.\n"
    ),
    "maintain": (
        "- PRIMARY GOAL: MAINTAIN current fitness. Keep weekly volume within +-10% of recent weeks, "
        "no progressive overload, keep 1 quality session per week.\n"
    ),
    "improve_endurance": (
        "- PRIMARY GOAL: ENDURANCE. Progress the long session and total aerobic volume; "
        "intensity stays mostly easy.\n"
    ),
    "improve_speed": (
        "- PRIMARY GOAL: SPEED. Keep an easy aerobic base, add 1-2 quality sessions "
        "(intervals, tempo) per week with full recovery between them.\n"
    ),
    "improve_overall": (
        "- PRIMARY GOAL: ALL-ROUND development - balance aerobic base, one quality session "
        "and strength.\n"
    ),
}

_CASUAL_LANGUAGE = (
    "  - LANGUAGE: the athlete is not a sports expert. In titles and notes use plain everyday "
    "words; avoid jargon (VO2max, threshold, LT2, tempo, fartlek, TSS). Describe effort as "
    "'easy, you can talk' / 'a bit faster, breathing harder'.\n"
)


def has_a_race(prefs: Dict[str, Any]) -> bool:
    """User má aspoň jedny preteky s dátumom - cieľ pretekov má prednosť."""
    targets = prefs.get("targets") if isinstance(prefs, dict) else None
    run = targets.get("run") if isinstance(targets, dict) else None
    races = run.get("races") if isinstance(run, dict) else None
    if not isinstance(races, list):
        return False
    return any(isinstance(r, dict) and r.get("date") for r in races)


def build_goal_rule(goal_kind: Optional[str], *, has_race: bool = False) -> str:
    """Pravidlo do promptu podľa goal_kind. Prázdny reťazec, ak cieľ nie je zadaný."""
    key = str(goal_kind or "").strip().lower()
    text = _GOAL_TEXT.get(key)
    if not text:
        return ""
    out = text
    if key in CASUAL_GOALS:
        out += _CASUAL_LANGUAGE
    if has_race:
        out += (
            "  - The athlete also has a race in prefs.targets: prepare for it safely, "
            "but keep the spirit of this goal.\n"
        )
    return out + "\n"
