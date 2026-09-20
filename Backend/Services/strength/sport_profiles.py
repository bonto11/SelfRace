# Services/strength/sport_profiles.py
"""
Šport-špecifický dôraz pri výbere cvikov.

Mapuje disciplínu athléta (main_sport + race_type) na:
  - sport_emphasis: tagy z katalógu, ktoré sa pri skórovaní bonusujú
  - priority_patterns: pohybové vzory, ktoré musia byť pokryté
  - extra_slots: doplnkové sloty pridané k šablóne (napr. grip pre OCR)

Zdroj pre špecifiká:
  Hyrox - väčšina stanic je jednonožne dominantná, grip je typicky slabý
  článok (predlaktia odpadnú skôr než nohy), kľúčové sú sled push/pull,
  farmer's carry, wall balls, sandbag lunges. Bez sane sa sled push
  trénuje goblet drepmi, front-loaded carries a ťažkými step-upmi; sled
  pull veslovaním, lat pulldownmi a rope climbs.

  OCR/Spartan - grip a visové schopnosti (monkey bars, rope climb,
  dead hang), nosenie bremien (bucket, sandbag), anti-rotačný core,
  vertikálny ťah.

  Beh - jednonožná sila, lýtka a tibialis (prevencia shin splints),
  stabilita bedier. Vyhýbať sa vysokej excentrickej záťaži pred
  kvalitnými behmi.

  Plávanie - zdravie ramien (rotátorová manžeta, lopatky), lat a
  horizontálny ťah, rotačný core. Menej hmoty na hornej časti tela.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from Services.strength.templates import (
    BLOCK_MAIN,
    BLOCK_ADDONS,
    _slot,
)


# ============================================================
# PROFILY
# ============================================================

PROFILE_GENERAL = {
    "key": "general",
    "emphasis": {"general"},
    "priority_patterns": ["squat", "hinge", "pull_h", "push_v"],
    "extra_slots": [],
    "notes_en": "Balanced full-body strength.",
}

PROFILE_RUNNING = {
    "key": "running",
    "emphasis": {"running", "general"},
    "priority_patterns": ["squat", "hinge", "lunge", "calf"],
    "extra_slots": [
        _slot("calf", "accessory", BLOCK_ADDONS, required=False),
    ],
    "notes_en": "Single-leg strength, calf/tibialis resilience, hip stability.",
}

PROFILE_HYROX = {
    "key": "hyrox",
    "emphasis": {"hyrox", "general"},
    "priority_patterns": ["squat", "hinge", "lunge", "carry", "pull_h", "push_v"],
    "extra_slots": [
        # Carry = farmer's carry / sandbag - grip aj trup naraz,
        # priamo prenositeľné na dve Hyrox stanice.
        _slot("carry", "secondary", BLOCK_MAIN, required=False),
        _slot("grip", "accessory", BLOCK_ADDONS, required=False),
    ],
    "notes_en": "Unilateral leg drive, carries, grip endurance, compromised work.",
}

PROFILE_OCR = {
    "key": "ocr",
    "emphasis": {"ocr", "general"},
    "priority_patterns": ["pull_v", "grip", "carry", "anti_rotation", "squat"],
    "extra_slots": [
        # Grip je pri OCR najčastejší dôvod zlyhania na prekážke.
        _slot("grip", "secondary", BLOCK_MAIN, required=False),
        _slot("carry", "secondary", BLOCK_MAIN, required=False),
        _slot("anti_rotation", "accessory", BLOCK_ADDONS, required=False),
    ],
    "notes_en": "Grip and hang capacity, vertical pull, loaded carries, anti-rotation core.",
}

PROFILE_SWIMMING = {
    "key": "swimming",
    "emphasis": {"swimming", "general"},
    "priority_patterns": ["pull_h", "pull_v", "rotation", "anti_rotation"],
    "extra_slots": [
        _slot("pull_h", "prehab", BLOCK_ADDONS, required=False),
    ],
    "notes_en": "Shoulder health, lat and horizontal pull, rotational core.",
}

PROFILE_TRIATHLON = {
    "key": "triathlon",
    "emphasis": {"triathlon", "running", "swimming", "general"},
    "priority_patterns": ["squat", "hinge", "pull_h", "calf"],
    "extra_slots": [
        _slot("calf", "accessory", BLOCK_ADDONS, required=False),
    ],
    "notes_en": "Low-volume maintenance strength across all three disciplines.",
}

ALL_PROFILES = {
    p["key"]: p
    for p in (
        PROFILE_GENERAL,
        PROFILE_RUNNING,
        PROFILE_HYROX,
        PROFILE_OCR,
        PROFILE_SWIMMING,
        PROFILE_TRIATHLON,
    )
}


# ============================================================
# RESOLVE
# ============================================================

def resolve_sport_profile(
    *,
    main_sport: Optional[str],
    race_type: Optional[str] = None,
    add_on_sports: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Vyberie profil podľa disciplíny. race_type má prednosť pred
    main_sport - kto beží Spartan, potrebuje iné cviky než cestný bežec,
    aj keď main_sport je v oboch prípadoch 'run'.
    """
    rt = str(race_type or "").strip().lower()
    ms = str(main_sport or "").strip().lower()
    addons = {str(s).lower() for s in (add_on_sports or [])}

    if rt == "hyrox":
        return PROFILE_HYROX
    if rt == "ocr":
        return PROFILE_OCR

    # Triatlon: beh + bicykel + plávanie naraz
    if ms and {"swim", "ride"} <= (addons | {ms}):
        return PROFILE_TRIATHLON

    if ms == "run":
        return PROFILE_RUNNING
    if ms == "swim":
        return PROFILE_SWIMMING

    return PROFILE_GENERAL


def apply_profile_to_template(
    template: Dict[str, Any], profile: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Pridá k šablóne šport-špecifické sloty. Nemodifikuje originál -
    šablóny sú zdieľané konštanty, preto vraciame kópiu.

    Duplicitné sloty (rovnaký pattern+tier+block) sa nepridávajú, aby
    sa napr. calf slot neobjavil dvakrát pri bežeckom profile nad
    šablónou, ktorá ho už má.
    """
    base_slots = list(template.get("slots") or [])
    existing = {
        (s["pattern"], s["tier"], s["block"]) for s in base_slots
    }

    for extra in profile.get("extra_slots") or []:
        key = (extra["pattern"], extra["tier"], extra["block"])
        if key in existing:
            continue
        base_slots.append(extra)
        existing.add(key)

    return {
        **template,
        "slots": base_slots,
        "sport_profile": profile["key"],
    }
