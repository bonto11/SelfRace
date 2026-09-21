# Services/strength/schemes.py
"""
Tabuľky sérií / opakovaní / páuz podľa tréningového cieľa, úrovne a tieru cviku.

Zdroj: NSCA position stand + ACSM progression models.
  - max sila:          1-6 opak., >=85% 1RM, 3-5 sérií, pauza 2-5 min
  - hypertrofia:       6-12 opak., 67-85% 1RM, 3-6 sérií, pauza 1-2 min
  - silová vytrvalosť: >15 opak., 40-60% 1RM, 2-3 série, pauza <90 s
  - výbušnosť:         3-5 opak., 30-60% 1RM rýchlo, 3-5 sérií, pauza 2-5 min

Toto je DETERMINISTICKÁ vrstva - AI tieto čísla už nevymýšľa, iba dostane
hotovú kostru a dopĺňa coaching vrstvu (názvy, poznámky, cueing).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# ------------------------------------------------------------
# CIELE
# ------------------------------------------------------------

GOAL_MAX_STRENGTH = "max_strength"
GOAL_HYPERTROPHY = "hypertrophy"
GOAL_STRENGTH_ENDURANCE = "strength_endurance"
GOAL_POWER = "power"
GOAL_GENERAL_RESILIENCE = "general_resilience"  # default pre vytrvalcov

ALL_GOALS = [
    GOAL_MAX_STRENGTH,
    GOAL_HYPERTROPHY,
    GOAL_STRENGTH_ENDURANCE,
    GOAL_POWER,
    GOAL_GENERAL_RESILIENCE,
]

LEVEL_BEGINNER = "beginner"
LEVEL_INTERMEDIATE = "intermediate"
LEVEL_ADVANCED = "advanced"

ALL_LEVELS = [LEVEL_BEGINNER, LEVEL_INTERMEDIATE, LEVEL_ADVANCED]


# ------------------------------------------------------------
# ZÁKLADNÉ SCHÉMY: goal -> tier -> parametre
# ------------------------------------------------------------
# reps je string, lebo AI aj UI ho zobrazujú ako rozsah ("6-8").
# rest_s je reálny čas v sekundách - vstup pre výpočet dĺžky tréningu.
# intensity_pct je orientačné % 1RM pre budúcu progresnú logiku.

SCHEMES: Dict[str, Dict[str, Dict[str, Any]]] = {
    GOAL_MAX_STRENGTH: {
        "primary":   {"sets": 4, "reps": "4-6",   "rest_s": 180, "intensity_pct": [85, 90], "rir": 2},
        "secondary": {"sets": 3, "reps": "6-8",   "rest_s": 150, "intensity_pct": [78, 85], "rir": 2},
        "accessory": {"sets": 3, "reps": "8-10",  "rest_s": 90,  "intensity_pct": [65, 75], "rir": 2},
        "prehab":    {"sets": 2, "reps": "10-12", "rest_s": 45,  "intensity_pct": None,     "rir": 3},
    },
    GOAL_HYPERTROPHY: {
        "primary":   {"sets": 4, "reps": "6-10",  "rest_s": 150, "intensity_pct": [70, 82], "rir": 2},
        "secondary": {"sets": 4, "reps": "8-12",  "rest_s": 105, "intensity_pct": [67, 78], "rir": 1},
        "accessory": {"sets": 3, "reps": "10-15", "rest_s": 75,  "intensity_pct": [60, 70], "rir": 1},
        "prehab":    {"sets": 2, "reps": "12-15", "rest_s": 45,  "intensity_pct": None,     "rir": 3},
    },
    GOAL_STRENGTH_ENDURANCE: {
        "primary":   {"sets": 3, "reps": "15-20", "rest_s": 75,  "intensity_pct": [50, 60], "rir": 2},
        "secondary": {"sets": 3, "reps": "15-20", "rest_s": 60,  "intensity_pct": [45, 58], "rir": 2},
        "accessory": {"sets": 3, "reps": "20-25", "rest_s": 45,  "intensity_pct": [40, 50], "rir": 1},
        "prehab":    {"sets": 2, "reps": "15-20", "rest_s": 40,  "intensity_pct": None,     "rir": 3},
    },
    GOAL_POWER: {
        "primary":   {"sets": 5, "reps": "3-5",   "rest_s": 180, "intensity_pct": [40, 60], "rir": 4},
        "secondary": {"sets": 4, "reps": "4-6",   "rest_s": 150, "intensity_pct": [40, 60], "rir": 4},
        "accessory": {"sets": 3, "reps": "8-10",  "rest_s": 90,  "intensity_pct": [55, 70], "rir": 2},
        "prehab":    {"sets": 2, "reps": "10-12", "rest_s": 45,  "intensity_pct": None,     "rir": 3},
    },
    # Default pre vytrvalcov: dosť ťažké na zachovanie sily a odolnosti,
    # ale nízky objem a únava, aby to nezasahovalo do behov.
    GOAL_GENERAL_RESILIENCE: {
        "primary":   {"sets": 3, "reps": "6-8",   "rest_s": 150, "intensity_pct": [75, 85], "rir": 3},
        "secondary": {"sets": 3, "reps": "8-12",  "rest_s": 105, "intensity_pct": [65, 78], "rir": 3},
        "accessory": {"sets": 2, "reps": "12-15", "rest_s": 60,  "intensity_pct": [55, 70], "rir": 2},
        "prehab":    {"sets": 2, "reps": "12-15", "rest_s": 45,  "intensity_pct": None,     "rir": 3},
    },
}


# ------------------------------------------------------------
# ÚPRAVY PODĽA ÚROVNE
# ------------------------------------------------------------
# Začiatočník: menej sérií, vyššie opakovania (technika pred záťažou),
#              nižšia intenzita - Rhea et al.: netrénovaní reagujú najlepšie
#              na ~60% 1RM, trénovaní na ~80%.
# Pokročilý:   viac sérií, tolerancia vyššieho objemu.

LEVEL_ADJUSTMENTS: Dict[str, Dict[str, Any]] = {
    LEVEL_BEGINNER: {
        "sets_delta": -1,
        "min_sets": 2,
        "rest_multiplier": 0.85,
        "force_min_reps": 8,     # žiadne 3-5 opak. pre začiatočníka
        "max_skill_demand": "med",
        "rir_delta": 1,          # ďalej od zlyhania
    },
    LEVEL_INTERMEDIATE: {
        "sets_delta": 0,
        "min_sets": 2,
        "rest_multiplier": 1.0,
        "force_min_reps": None,
        "max_skill_demand": "high",
        "rir_delta": 0,
    },
    LEVEL_ADVANCED: {
        "sets_delta": 1,
        "min_sets": 3,
        "rest_multiplier": 1.0,
        "force_min_reps": None,
        "max_skill_demand": "high",
        "rir_delta": 0,
    },
}


# ------------------------------------------------------------
# TÝŽDENNÉ OBJEMOVÉ CIELE
# ------------------------------------------------------------
# Schoenfeld et al. 2017: >=10 sérií na svalovú skupinu týždenne takmer
# zdvojnásobuje hypertrofiu oproti <=5 sériám. Pre vytrvalcov držíme
# nižšie, aby sa neprejavil interferenčný efekt.

WEEKLY_SET_TARGETS: Dict[str, Dict[str, int]] = {
    GOAL_MAX_STRENGTH:        {"per_pattern_min": 4,  "per_pattern_max": 10, "total_max": 60},
    GOAL_HYPERTROPHY:         {"per_pattern_min": 8,  "per_pattern_max": 16, "total_max": 90},
    GOAL_STRENGTH_ENDURANCE:  {"per_pattern_min": 4,  "per_pattern_max": 10, "total_max": 55},
    GOAL_POWER:               {"per_pattern_min": 3,  "per_pattern_max": 8,  "total_max": 45},
    GOAL_GENERAL_RESILIENCE:  {"per_pattern_min": 3,  "per_pattern_max": 8,  "total_max": 40},
}


# ------------------------------------------------------------
# DELOAD
# ------------------------------------------------------------

DELOAD_EVERY_N_WEEKS = 5
DELOAD_SETS_MULTIPLIER = 0.6
DELOAD_INTENSITY_MULTIPLIER = 0.85


_SKILL_ORDER = {"low": 0, "med": 1, "high": 2}


def _min_reps_from_range(reps: str) -> Optional[int]:
    try:
        return int(str(reps).split("-")[0].strip())
    except Exception:
        return None


def _bump_reps_to_min(reps: str, min_reps: int) -> str:
    """Posunie rozsah opakovaní nahor, ak je pod povolené minimum."""
    parts = str(reps).split("-")
    try:
        lo = int(parts[0].strip())
        hi = int(parts[1].strip()) if len(parts) > 1 else lo
    except Exception:
        return reps
    if lo >= min_reps:
        return reps
    delta = min_reps - lo
    return f"{lo + delta}-{hi + delta}"


def get_scheme(
    *,
    goal: str,
    tier: str,
    level: str = LEVEL_INTERMEDIATE,
    is_deload: bool = False,
) -> Dict[str, Any]:
    """
    Vráti konkrétne série/opakovania/pauzu pre jeden cvik.

    Toto je jediné miesto, kde sa tieto čísla určujú - AI ich nikdy
    nevymýšľa, iba dostane hotový výsledok.
    """
    goal_safe = goal if goal in SCHEMES else GOAL_GENERAL_RESILIENCE
    tier_safe = tier if tier in SCHEMES[goal_safe] else "accessory"
    level_safe = level if level in LEVEL_ADJUSTMENTS else LEVEL_INTERMEDIATE

    base = dict(SCHEMES[goal_safe][tier_safe])
    adj = LEVEL_ADJUSTMENTS[level_safe]

    sets = base["sets"] + adj["sets_delta"]
    sets = max(adj["min_sets"], sets)

    reps = base["reps"]
    if adj["force_min_reps"]:
        reps = _bump_reps_to_min(reps, adj["force_min_reps"])

    rest_s = int(round(base["rest_s"] * adj["rest_multiplier"]))

    rir = base.get("rir")
    if rir is not None:
        rir = rir + adj["rir_delta"]

    intensity = base.get("intensity_pct")

    if is_deload:
        sets = max(1, int(round(sets * DELOAD_SETS_MULTIPLIER)))
        if intensity:
            intensity = [
                int(round(intensity[0] * DELOAD_INTENSITY_MULTIPLIER)),
                int(round(intensity[1] * DELOAD_INTENSITY_MULTIPLIER)),
            ]
        if rir is not None:
            rir += 2

    return {
        "sets": sets,
        "reps": reps,
        "rest_s": rest_s,
        "intensity_pct": intensity,
        "rir": rir,
        "goal": goal_safe,
        "tier": tier_safe,
        "level": level_safe,
        "is_deload": is_deload,
    }


def estimate_exercise_duration_s(scheme: Dict[str, Any]) -> int:
    """
    Odhad reálneho času jedného cviku v sekundách.

    Séria = práca + pauza. Práca sa odhaduje z počtu opakovaní
    (~3.5 s na opakovanie vrátane setupu). Posledná séria nemá pauzu,
    ale pripočítame ~45 s na presun/prípravu ďalšieho cviku.
    """
    sets = int(scheme.get("sets") or 0)
    if sets <= 0:
        return 0

    min_reps = _min_reps_from_range(scheme.get("reps") or "") or 10
    work_per_set_s = max(20, int(min_reps * 3.5))
    rest_s = int(scheme.get("rest_s") or 60)

    total = sets * work_per_set_s + (sets - 1) * rest_s + 45
    return int(total)


def estimate_block_duration_s(schemes: List[Dict[str, Any]]) -> int:
    """Súčet odhadovaného času cez viac cvikov."""
    return sum(estimate_exercise_duration_s(s) for s in schemes)


def is_deload_week(week_index: int) -> bool:
    """Každý N-tý týždeň je deload (objem dole ~40%)."""
    if week_index <= 0:
        return False
    return week_index % DELOAD_EVERY_N_WEEKS == 0