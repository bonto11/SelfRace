# Configs/strength_volume.py
"""
Týždenné objemové ciele na svalovú partiu + bezpečnostné stropy pre bežcov.

PREČO SÉRIE NA PARTIU:
Objem v kg nič nehovorí (10 kg bicepsový zdvih vs 100 kg drep). Počet
PRACOVNÝCH sérií na partiu za týždeň je veličina, s ktorou pracuje odborná
literatúra aj bežná tréningová prax, a user jej rozumie.

PÁSMA (série/partia/týždeň, warmup sa neráta):
  4-8    udržiavanie - svaly sa nestratia, únava minimálna
  10-20  rozvoj - pásmo, kde reálne rastie sila a hmota
  22+    klesajúci prínos, rastúca únava

INTERFERENČNÝ EFEKT (súbežný beh + posilňovanie):
Beh a silový tréning si konkurujú v regenerácii. Najviac to dopadá na NOHY
(kvadricepsy, hamstringy, lýtka) - tie už dostávajú stimul z behu a majú
z neho aj poškodenie svalových vlákien. Horná časť tela je behom prakticky
nedotknutá, tam sa dá naberať aj vo vysokom behovom objeme.

Preto: cieľ "develop" platí naplno pre hornú časť tela a core, ale pre nohy
sa strop znižuje podľa toho, koľko user reálne behá.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

VolumeGoal = Literal["maintain", "develop"]

# Partie, ktoré beh sám o sebe zaťažuje -> pri vysokom behovom objeme sa
# ich silový objem strope, aby sa user neprepálil.
RUNNING_LOADED_MUSCLES = {"quads", "hamstrings", "calves", "glutes"}

# Základné ciele (série/partia/týždeň)
BASE_TARGET = {
    "maintain": 6,
    "develop": 12,
}

# Pásma týždenného objemu - zdroj pravdy pre backend aj pre graf v UI
VOLUME_BANDS = {
    "maintenance_min": 4,
    "maintenance_max": 8,
    "development_min": 10,
    "development_max": 20,
    "overreach": 22,
}

# Pásma týždenného behového objemu (minúty behu za týždeň)
RUN_VOLUME_TIERS = {
    "low": 180,       # do 3 h behu - silový tréning nič nelimituje
    "moderate": 360,  # 3-6 h - nohy sa priškrtia
    # nad 360 min = "high"
}

# Strop pre bežecké partie podľa behového objemu
LEG_CAP_BY_TIER = {
    "low": 20,       # bez reálneho obmedzenia
    "moderate": 12,  # rozvoj áno, ale nie maximálny
    "high": 8,       # len udržiavanie - prioritou je beh
}

# Malé partie nepotrebujú toľko priamej práce ako veľké - dostávajú objem
# aj nepriamo z veľkých cvikov (zlomkový objem v strength_muscles.py).
SMALL_MUSCLE_FACTOR = {
    "biceps": 0.7,
    "triceps": 0.7,
    "forearms": 0.5,
    "calves": 0.7,
}


def run_volume_tier(weekly_run_minutes: Optional[float]) -> str:
    """low | moderate | high podľa týždenného objemu behu."""
    if weekly_run_minutes is None:
        return "low"
    if weekly_run_minutes <= RUN_VOLUME_TIERS["low"]:
        return "low"
    if weekly_run_minutes <= RUN_VOLUME_TIERS["moderate"]:
        return "moderate"
    return "high"


def volume_status(sets_per_week: float) -> str:
    """
    Zaradí týždenný objem partie do pásma.
    none | low | maintenance | development | high
    """
    if sets_per_week <= 0:
        return "none"
    if sets_per_week < VOLUME_BANDS["maintenance_min"]:
        return "low"
    if sets_per_week < VOLUME_BANDS["development_min"]:
        return "maintenance"
    if sets_per_week <= VOLUME_BANDS["development_max"]:
        return "development"
    return "high"


def volume_bands_public() -> Dict[str, int]:
    """Pásma pre UI - aby FE neduplikoval čísla z tohto súboru."""
    return dict(VOLUME_BANDS)


def target_for_muscle(
    muscle: str,
    *,
    goal: VolumeGoal = "maintain",
    weekly_run_minutes: Optional[float] = None,
    sessions_per_week: Optional[int] = None,
) -> int:
    """
    Cieľový počet pracovných sérií na partiu za týždeň.

    goal:                maintain | develop
    weekly_run_minutes:  reálny behový objem - limituje nohy
    sessions_per_week:   koľko silových tréningov user plánuje - pri 1 tréningu
                         týždenne nemá zmysel cieliť 12 sérií na partiu
    """
    base = BASE_TARGET.get(goal, BASE_TARGET["maintain"])

    # Nohy: strop podľa behu
    if muscle in RUNNING_LOADED_MUSCLES:
        cap = LEG_CAP_BY_TIER[run_volume_tier(weekly_run_minutes)]
        base = min(base, cap)

    # Malé partie potrebujú menej priamej práce
    factor = SMALL_MUSCLE_FACTOR.get(muscle)
    if factor:
        base = base * factor

    # Realita počtu tréningov: na jeden tréning sa nezmestí viac než
    # ~6 kvalitných sérií na partiu
    if sessions_per_week and sessions_per_week > 0:
        base = min(base, sessions_per_week * 6)

    return max(3, int(round(base)))


def build_targets(
    muscles: List[str],
    *,
    goal: VolumeGoal = "maintain",
    weekly_run_minutes: Optional[float] = None,
    sessions_per_week: Optional[int] = None,
) -> Dict[str, int]:
    """Ciele pre všetky partie naraz."""
    return {
        m: target_for_muscle(
            m,
            goal=goal,
            weekly_run_minutes=weekly_run_minutes,
            sessions_per_week=sessions_per_week,
        )
        for m in muscles
    }


def compare_to_target(actual_sets: float, target_sets: int) -> Dict[str, object]:
    """
    Porovnanie odcvičeného objemu voči cieľu.
    status: none | under | on_track | over
    """
    pct = (actual_sets / target_sets * 100) if target_sets > 0 else 0

    if actual_sets <= 0:
        status = "none"
    elif pct < 60:
        status = "under"
    elif pct <= 130:
        status = "on_track"
    else:
        status = "over"

    return {
        "actual": round(actual_sets, 1),
        "target": target_sets,
        "pct": round(pct),
        "status": status,
    }