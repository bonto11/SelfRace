# Services/strength/sport_profiles.py
"""
Šport-špecifický dôraz pri výbere cvikov.

Mapuje disciplínu athléta (main_sport + race_type) na:
  - emphasis: tagy z katalógu, ktoré sa pri skórovaní bonusujú
  - priority_patterns: pohybové vzory, ktorými sa dopĺňa krátka session
  - extra_slots: doplnkové sloty pridané k šablóne (napr. grip pre OCR)

Zdroj pre špecifiká:
  Hyrox - väčšina stanic je jednonožne dominantná, grip je typicky slabý
  článok, kľúčové sú sled push/pull, farmer's carry, wall balls, sandbag
  lunges.

  OCR/Spartan - grip a visové schopnosti (monkey bars, rope climb, dead
  hang), nosenie bremien, anti-rotačný core, vertikálny ťah.

  Beh - ťažká sila + plyometria zlepšujú bežeckú ekonomiku a rýchlosť
  (prehľady Rønnestad & Mujika 2014, Blagrove a kol. 2018). Jednonožná
  sila, lýtka/soleus, stabilita bedier. Vyhýbať sa vysokej excentrickej
  záťaži pred kvalitnými behmi.

  Plávanie - zdravie ramien, lat a horizontálny ťah, rotačný core.

🌟 NOVÉ (v2): ŠPECIFICKOSŤ K PRETEKU (strength_settings.sport_specificity)
  Pre bežca s OCR/Hyrox pretekom rozhoduje, čomu sa posilka venuje:
    low      - posilka ide na beh (plyometria, ťažké nohy, lýtka),
               preteková špecifika (grip/carry) len v doplnkoch na udržanie.
               Pre athléta, ktorý je v OCR veciach silný a zaostáva beh.
    balanced - beh aj preteková špecifika v hlavnej časti (default).
    high     - dôraz na špecifiká preteku (pôvodné správanie OCR/Hyrox profilu).
  Pre čistého bežca (bez OCR/Hyrox preteku) sa nastavenie neuplatní -
  vždy dostane bežecký výkonový blok.

  Extra sloty majú trim_priority (1-9): pri prekročení rozpočtu sérií
  selector najprv uberá/orezáva sloty s nižšou prioritou. Povinné sloty
  šablóny majú 9, voliteľné sloty šablóny 5.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Services.strength.templates import (
    BLOCK_MAIN,
    BLOCK_ADDONS,
    _slot,
)

SPECIFICITY_LOW = "low"
SPECIFICITY_BALANCED = "balanced"
SPECIFICITY_HIGH = "high"
ALL_SPECIFICITY = [SPECIFICITY_LOW, SPECIFICITY_BALANCED, SPECIFICITY_HIGH]


def _ex(slot: Dict[str, Any], **kw: Any) -> Dict[str, Any]:
    """Rozšíri slot o ďalšie kľúče (trim_priority, scheme_override, ...)."""
    out = dict(slot)
    out.update(kw)
    return out


# ============================================================
# PÔVODNÉ PROFILY (resolve_sport_profile - spätná kompatibilita)
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


def resolve_sport_profile(
    *,
    main_sport: Optional[str],
    race_type: Optional[str] = None,
    add_on_sports: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Vyberie základný profil podľa disciplíny. race_type má prednosť pred
    main_sport - kto beží Spartan, potrebuje iné cviky než cestný bežec.
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


# ============================================================
# 🌟 NOVÉ: STAVEBNÉ BLOKY PRE BUILD_SPORT_PROFILE
# ============================================================
# Funkcie (nie konštanty), aby každé volanie dostalo nové dict objekty -
# selector si do slotov nič nezapisuje, ale zdieľané mutable konštanty
# naprieč sessionmi sú zbytočné riziko.

def _run_plyo(trim: int) -> Dict[str, Any]:
    """
    Plyometria (box jump / pogo / broad jump) - ide na ZAČIATOK hlavnej
    časti, kým je athlete čerstvý (výbušnosť sa pri únave nedá trénovať).
    Vlastná schéma 3x4-6, pauza 90 s - nízky objem, vysoká kvalita.
    """
    return _ex(
        _slot("jump", "secondary", BLOCK_MAIN, required=False),
        scheme_override={"sets": 3, "reps": "4-6", "rest_s": 90},
        load_types=["bodyweight"],   # box jump / pogo / broad jump, nie assault bike
        order_first=True,
        trim_priority=trim,
    )


def _run_calf_main(trim: int) -> Dict[str, Any]:
    """
    Ťažké lýtka/soleus v hlavnej časti (nie len ako ľahký doplnok) -
    soleus nesie pri behu najväčšiu záťaž. Nahradí ľahký calf doplnok
    šablóny, aby neboli dva lýtkové cviky.
    """
    return _ex(
        _slot("calf", "secondary", BLOCK_MAIN, required=False),
        replace_same_pattern=True,
        trim_priority=trim,
    )


def _race_major(race: str, trim: int) -> List[Dict[str, Any]]:
    """Preteková špecifika v hlavnej časti (dôraz)."""
    if race == "ocr":
        return [
            _ex(_slot("grip", "secondary", BLOCK_MAIN, required=False), trim_priority=trim),
            _ex(_slot("carry", "secondary", BLOCK_MAIN, required=False), trim_priority=trim),
            _ex(_slot("anti_rotation", "accessory", BLOCK_ADDONS, required=False), trim_priority=trim),
        ]
    if race == "hyrox":
        return [
            _ex(_slot("carry", "secondary", BLOCK_MAIN, required=False), trim_priority=trim),
            _ex(_slot("grip", "accessory", BLOCK_ADDONS, required=False), trim_priority=trim),
        ]
    return []


def _race_minor(race: str) -> List[Dict[str, Any]]:
    """Preteková špecifika len na udržanie - jeden krátky doplnok."""
    if race == "ocr":
        return [_ex(_slot("grip", "accessory", BLOCK_ADDONS, required=False), trim_priority=3)]
    if race == "hyrox":
        return [_ex(_slot("carry", "accessory", BLOCK_ADDONS, required=False), trim_priority=3)]
    return []


def build_sport_profile(
    *,
    main_sport: Optional[str],
    race_type: Optional[str] = None,
    add_on_sports: Optional[List[str]] = None,
    specificity: Optional[str] = None,
) -> Dict[str, Any]:
    """
    🌟 NOVÉ: zostaví profil pre selector vrátane špecifickosti k preteku.
    Toto volá builder (resolve_sport_profile ostáva kvôli kompatibilite).
    """
    base = resolve_sport_profile(
        main_sport=main_sport, race_type=race_type, add_on_sports=add_on_sports
    )
    spec = specificity if specificity in ALL_SPECIFICITY else SPECIFICITY_BALANCED
    is_runner = str(main_sport or "").strip().lower() == "run"
    key = base["key"]

    # --- bežec s OCR/Hyrox pretekom: tu rozhoduje špecifickosť ---
    if key in ("ocr", "hyrox") and is_runner:
        if spec == SPECIFICITY_LOW:
            return {
                "key": f"{key}_run_focus",
                "base_key": key,
                "specificity": spec,
                "emphasis": {"running", "general"},
                "priority_patterns": ["lunge", "hinge", "pull_v", "push_h"],
                "extra_slots": [_run_plyo(7), _run_calf_main(6)] + _race_minor(key),
                # horná časť len na udržanie (minimálna dávka), rozpočet
                # ide na nohy - výpady a hinge vydržia dlhšie než lýtka
                "upper_main_max_sets": 2,
                "trim_boost": {"lunge": 7, "hinge": 6},
                # nosenie zo šablóny (full_body_c) nahradí zadný reťazec -
                # OCR udržanie rieši grip v doplnkoch
                "remove_template_patterns": ["carry"],
            }
        if spec == SPECIFICITY_HIGH:
            return {
                "key": key,
                "base_key": key,
                "specificity": spec,
                "emphasis": {key, "general"},
                "priority_patterns": list(base["priority_patterns"]),
                "extra_slots": _race_major(key, 6)
                + [_ex(_slot("calf", "accessory", BLOCK_ADDONS, required=False), trim_priority=4)],
            }
        # balanced
        return {
            "key": f"{key}_balanced",
            "base_key": key,
            "specificity": spec,
            "emphasis": {"running", key, "general"},
            "priority_patterns": ["lunge", "pull_v", "carry", "hinge"],
            # OCR/Hyrox práca (6) má prednosť pred voliteľnými slotmi
            # šablóny (5), inak by "vyvážená" vyšla bez pretekovej práce
            "extra_slots": [_run_plyo(6), _run_calf_main(4)] + _race_major(key, 6),
            "upper_main_max_sets": 2,
        }

    # --- čistý bežec (cesta/trail) - vždy bežecký výkonový blok ---
    if key == "running":
        return {
            "key": "running",
            "base_key": key,
            "specificity": spec,
            "emphasis": {"running", "general"},
            "priority_patterns": ["lunge", "hinge", "pull_v", "push_h"],
            "extra_slots": [_run_plyo(7), _run_calf_main(6)],
            "upper_main_max_sets": 2,
            "trim_boost": {"lunge": 7, "hinge": 6},
        }

    # --- ostatné profily bez zmeny (nové kópie slotov) ---
    return {
        "key": key,
        "base_key": key,
        "specificity": spec,
        "emphasis": set(base["emphasis"]),
        "priority_patterns": list(base["priority_patterns"]),
        "extra_slots": [dict(s) for s in base.get("extra_slots") or []],
    }


def apply_profile_to_template(
    template: Dict[str, Any], profile: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Pridá k šablóne šport-špecifické sloty. Nemodifikuje originál -
    šablóny sú zdieľané konštanty, preto pracujeme s kópiami slotov.

    Duplicitné sloty (rovnaký pattern+tier+block) sa nepridávajú.

    🌟 NOVÉ: extra slot s replace_same_pattern=True najprv odstráni zo
    šablóny ľahké (accessory/prehab) sloty rovnakého vzoru - napr. ťažké
    lýtka v hlavnej časti nahradia ľahký lýtkový doplnok.
    """
    base_slots = [dict(s) for s in (template.get("slots") or [])]

    # 🌟 NOVÉ: profil môže zo šablóny odstrániť voliteľné sloty vzorov,
    # ktoré pre daný režim nemajú prioritu (napr. carry pri "posilka na beh")
    remove = set(profile.get("remove_template_patterns") or [])
    if remove:
        base_slots = [
            s for s in base_slots
            if not (s["pattern"] in remove and not s.get("required"))
        ]

    for extra in profile.get("extra_slots") or []:
        if extra.get("replace_same_pattern"):
            base_slots = [
                s for s in base_slots
                if not (s["pattern"] == extra["pattern"] and s["tier"] in ("accessory", "prehab"))
            ]
        existing = {(s["pattern"], s["tier"], s["block"]) for s in base_slots}
        key = (extra["pattern"], extra["tier"], extra["block"])
        if key in existing:
            continue
        base_slots.append(dict(extra))

    return {
        **template,
        "slots": base_slots,
        "sport_profile": profile.get("key"),
    }