# Configs/activity_load.py
"""
Náročnosť nešportovej alebo doplnkovej aktivity.

PREČO SAMOSTATNE: svadba, teambuilding, sťahovanie alebo celodenná
prechádzka nie sú tréning, ale athléta reálne unavia - alebo mu aspoň
zoberú deň. AI poradca o nich musí vedieť, inak odporučí dlhý beh na deň
po svadbe.

Rovnaké stupne používa ručne pridaná udalosť v dennom pláne aj opakujúce
sa externé aktivity v prefs, aby si dve miesta v appke neprotirečili.

counts_as_training: či sa aktivita má rátať do tréningového objemu.
Futbal áno, svadba nie - inak by svadba zdvihla týždenný objem o 8 hodín
a AI by hlásila prepálený týždeň.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# Stupne náročnosti. Poradie je poradie v UI.
ACTIVITY_LOAD_LEVELS: List[str] = ["easy", "moderate", "hard"]

DEFAULT_ACTIVITY_LOAD = "easy"

# Ako sa jednotlivé stupne premietajú do únavy. Používa to AI kontext
# a prípadne neskôr výpočet záťaže.
ACTIVITY_LOAD_META: Dict[str, Dict[str, Any]] = {
    "easy": {
        "fatigue_weight": 0.2,
        "hint_en": "light - barely affects recovery",
    },
    "moderate": {
        "fatigue_weight": 0.6,
        "hint_en": "moderate - noticeable fatigue, plan around it",
    },
    "hard": {
        "fatigue_weight": 1.0,
        "hint_en": "demanding - treat it like a hard session for recovery",
    },
}


def normalize_activity_load(v: Any) -> str:
    """Bezpečne znormalizuje stupeň náročnosti na jednu z povolených hodnôt."""
    s = str(v or "").strip().lower()
    return s if s in ACTIVITY_LOAD_LEVELS else DEFAULT_ACTIVITY_LOAD


def activity_fatigue_weight(load: Any) -> float:
    """Váha únavy pre daný stupeň (0.2 - 1.0)."""
    meta = ACTIVITY_LOAD_META.get(normalize_activity_load(load)) or {}
    return float(meta.get("fatigue_weight") or 0.2)


def activity_load_hint(load: Any) -> str:
    """Krátky popis stupňa po anglicky - ide do AI kontextu, nie do UI."""
    meta = ACTIVITY_LOAD_META.get(normalize_activity_load(load)) or {}
    return str(meta.get("hint_en") or "")


# Druh udalosti. Len hrubé rozdelenie pre AI - presný popis dáva title.
ACTIVITY_EVENT_KINDS: List[str] = [
    "sport",      # športová aktivita mimo plánu (futbal, tenis, turistika)
    "work",       # pracovná záťaž (teambuilding, služobka, zmena)
    "social",     # spoločenská udalosť (svadba, oslava, večierok)
    "chore",      # fyzická práca (sťahovanie, záhrada, stavba)
    "travel",     # cestovanie
    "other",
]

DEFAULT_EVENT_KIND = "other"

# Ktoré druhy sa štandardne rátajú do tréningového objemu.
TRAINING_LIKE_KINDS = {"sport"}


def normalize_event_kind(v: Any) -> str:
    """Znormalizuje druh udalosti."""
    s = str(v or "").strip().lower()
    return s if s in ACTIVITY_EVENT_KINDS else DEFAULT_EVENT_KIND


def default_counts_as_training(kind: Any) -> bool:
    """Má sa tento druh udalosti štandardne rátať do objemu?"""
    return normalize_event_kind(kind) in TRAINING_LIKE_KINDS


def build_event_structure(
    *,
    kind: Any,
    load: Any,
    counts_as_training: Optional[bool] = None,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Štruktúra pre sport='other' riadok v coach_plan_daily.

    Zámerne iný tvar než tréningová štruktúra (žiadny main_part) - toto nie
    je tréning a nemá sa tak ani vykresľovať.
    """
    kind_clean = normalize_event_kind(kind)
    load_clean = normalize_activity_load(load)
    counts = (
        bool(counts_as_training)
        if counts_as_training is not None
        else default_counts_as_training(kind_clean)
    )

    out: Dict[str, Any] = {
        "event": {
            "kind": kind_clean,
            "load": load_clean,
            "counts_as_training": counts,
        }
    }
    if description:
        out["event"]["description"] = str(description)[:300]
    return out


def read_event_structure(structure: Any) -> Optional[Dict[str, Any]]:
    """Prečíta event blok zo štruktúry; None ak to nie je udalosť."""
    if not isinstance(structure, dict):
        return None
    ev = structure.get("event")
    if not isinstance(ev, dict):
        return None
    return {
        "kind": normalize_event_kind(ev.get("kind")),
        "load": normalize_activity_load(ev.get("load")),
        "counts_as_training": bool(ev.get("counts_as_training")),
        "description": ev.get("description") or None,
    }
