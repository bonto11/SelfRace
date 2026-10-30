# Services/AI/utils/recovery_extras.py
"""
Regeneračné praktiky z ranného zápisu recovery („Včera“): sauna, otužovanie,
masáž, mobilita, zdriemnutie, fyzioterapia, dychové cvičenia.

PREČO v recovery a nie v pláne: nejde o tréning, ale o vysvetlenie ranných
čísel – sauna večer zníži HRV a zvýši tep rovnako ako alkohol, a AI bez toho
hlási únavu. Zoznam kľúčov musí sedieť s FE (`RECOVERY_EXTRAS` v
features/recovery/constants/recoveryExtras.ts).
"""

from __future__ import annotations

from typing import Any, List, Optional

RECOVERY_EXTRAS = ("sauna", "cold", "massage", "mobility", "nap", "physio", "breathing")

FEATURE = "recovery_extras"


def normalize_recovery_extras(value: Any) -> Optional[List[str]]:
    """Len známe kľúče v pevnom poradí, bez duplicít. Prázdne = None (zmaže stĺpec)."""
    if not isinstance(value, (list, tuple)):
        return None
    picked = {str(v).strip() for v in value}
    out = [k for k in RECOVERY_EXTRAS if k in picked]
    return out or None


def recovery_extras_rule() -> str:
    return (
        "- RECOVERY PRACTICES ('extras' in 'recent_days', 'latest_extras'): what the athlete did on the "
        "day BEFORE that morning entry - 'sauna', 'cold' (cold shower, cold water or ice bath), 'massage', "
        "'mobility' (foam rolling, stretching, mobility work), 'nap', 'physio' (physiotherapy), "
        "'breathing' (breathing exercises). Name them in plain words in the athlete's language, never "
        "the keys.\n"
        "  - An evening sauna often lowers next-morning HRV and raises resting HR a little - an explained "
        "dip like alcohol, not fatigue or overtraining.\n"
        "  - Cold exposure within a few hours after a strength session blunts strength and muscle gains. "
        "If 'cold' falls on a strength day and strength or muscle is a goal, suggest moving it to a run "
        "day, a rest day or well after the session. After runs, races and on rest days it is fine.\n"
        "  - Massage, mobility, naps and breathing help soreness, sleep and how the athlete feels - "
        "acknowledge a regular habit briefly, but do not promise performance gains.\n"
        "  - A sauna series can help heat acclimation before a hot race; no long sauna the day before a "
        "race (dehydration); no sauna or cold exposure during an active illness or fever.\n"
        "  - Never invent practices that are not listed and never claim medical effects (immunity, detox).\n"
    )
