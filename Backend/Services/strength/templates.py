# Services/strength/templates.py
"""
Šablóny silových sessión - kostra slotov, ktorú potom selector.py naplní
konkrétnymi cvikmi z katalógu.

Prečo šablóny: AI predtým vyberala cviky voľne, čo viedlo k nevyváženým
tréningom (3x tlak, 0x ťah) a k tomu, že sa nedalo garantovať pokrytie
pohybových vzorov. Šablóna definuje, ČO tam má byť (slot = pohybový vzor
+ tier), selector rieši KTORÝ konkrétny cvik to naplní.

Split sa volí podľa počtu sessión za týždeň:
  1x/týždeň  -> full body (všetko naraz, inak sa niektoré vzory neodtrénujú)
  2x/týždeň  -> upper / lower
  3x/týždeň  -> full body A/B/C s rotujúcim dôrazom (pre vytrvalcov lepšie
                než push/pull/legs - každý tréning má nohy, ktoré sú
                pre beh najdôležitejšie)
  4+/týždeň  -> upper / lower striedavo
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# ------------------------------------------------------------
# SLOT
# ------------------------------------------------------------
# pattern: ktorý pohybový vzor slot žiada (viď catalog.pattern)
# tier:    primary | secondary | accessory | prehab - riadi schému
#          (sets/reps/rest) cez schemes.get_scheme()
# block:   do ktorého bloku session cvik patrí
# required: True = slot MUSÍ byť naplnený, inak je tréning nekompletný
#           False = naplní sa, len ak zostáva čas / je dostupný cvik
# prefer_unilateral: uprednostniť jednostranné varianty (bežci, Hyrox)

BLOCK_ACTIVATION = "activation"
BLOCK_MAIN = "strength_main_part"
BLOCK_ADDONS = "add_ons"


def _slot(
    pattern: str,
    tier: str,
    block: str,
    *,
    required: bool = True,
    prefer_unilateral: bool = False,
    allow_patterns: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    allow_patterns: alternatívne vzory, ak primárny nemá dostupný cvik
    (napr. slot 'hinge' padne na 'squat', ak nemá vybavenie na hinge).
    """
    return {
        "pattern": pattern,
        "tier": tier,
        "block": block,
        "required": required,
        "prefer_unilateral": prefer_unilateral,
        "allow_patterns": allow_patterns or [],
    }


# ------------------------------------------------------------
# ŠABLÓNY
# ------------------------------------------------------------
# Poradie slotov = poradie v tréningu. Aktivácia -> ťažké zložené ->
# doplnkové -> core/prehab. Ťažké cviky idú prvé, kým je athlete čerstvý.

TEMPLATE_FULL_BODY = {
    "key": "full_body",
    "name_en": "Full Body",
    "slots": [
        _slot("anti_rotation", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("hinge", "prehab", BLOCK_ACTIVATION, required=False),

        _slot("squat", "primary", BLOCK_MAIN),
        _slot("hinge", "primary", BLOCK_MAIN),
        _slot("pull_h", "secondary", BLOCK_MAIN, allow_patterns=["pull_v"]),
        _slot("push_v", "secondary", BLOCK_MAIN, allow_patterns=["push_h"]),
        _slot("lunge", "secondary", BLOCK_MAIN, required=False, prefer_unilateral=True),

        _slot("anti_extension", "accessory", BLOCK_ADDONS, required=False),
        _slot("calf", "accessory", BLOCK_ADDONS, required=False),
    ],
}

TEMPLATE_LOWER = {
    "key": "lower",
    "name_en": "Lower Body",
    "slots": [
        _slot("hinge", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("anti_rotation", "prehab", BLOCK_ACTIVATION, required=False),

        _slot("squat", "primary", BLOCK_MAIN),
        _slot("hinge", "primary", BLOCK_MAIN),
        _slot("lunge", "secondary", BLOCK_MAIN, prefer_unilateral=True),
        _slot("hinge", "secondary", BLOCK_MAIN, required=False),

        _slot("calf", "accessory", BLOCK_ADDONS),
        _slot("anti_extension", "accessory", BLOCK_ADDONS, required=False),
    ],
}

TEMPLATE_UPPER = {
    "key": "upper",
    "name_en": "Upper Body",
    "slots": [
        _slot("pull_h", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("push_h", "prehab", BLOCK_ACTIVATION, required=False),

        _slot("pull_h", "primary", BLOCK_MAIN, allow_patterns=["pull_v"]),
        _slot("push_v", "primary", BLOCK_MAIN, allow_patterns=["push_h"]),
        _slot("pull_v", "secondary", BLOCK_MAIN, allow_patterns=["pull_h"]),
        _slot("push_h", "secondary", BLOCK_MAIN, required=False, allow_patterns=["push_v"]),

        _slot("anti_extension", "accessory", BLOCK_ADDONS, required=False),
        _slot("rotation", "accessory", BLOCK_ADDONS, required=False),
    ],
}

# Full body varianty s rotujúcim dôrazom - pri 3x/týždeň sa striedajú,
# takže každý tréning má nohy (kľúčové pre bežcov), ale dôraz sa mení.
TEMPLATE_FULL_BODY_A = {
    "key": "full_body_a",
    "name_en": "Full Body A (Squat focus)",
    "slots": [
        _slot("anti_rotation", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("squat", "primary", BLOCK_MAIN),
        _slot("pull_h", "secondary", BLOCK_MAIN, allow_patterns=["pull_v"]),
        _slot("push_v", "secondary", BLOCK_MAIN, allow_patterns=["push_h"]),
        _slot("hinge", "secondary", BLOCK_MAIN, required=False),
        _slot("calf", "accessory", BLOCK_ADDONS, required=False),
        _slot("anti_extension", "accessory", BLOCK_ADDONS, required=False),
    ],
}

TEMPLATE_FULL_BODY_B = {
    "key": "full_body_b",
    "name_en": "Full Body B (Hinge focus)",
    "slots": [
        _slot("hinge", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("hinge", "primary", BLOCK_MAIN),
        _slot("push_h", "secondary", BLOCK_MAIN, allow_patterns=["push_v"]),
        _slot("pull_v", "secondary", BLOCK_MAIN, allow_patterns=["pull_h"]),
        _slot("lunge", "secondary", BLOCK_MAIN, required=False, prefer_unilateral=True),
        _slot("rotation", "accessory", BLOCK_ADDONS, required=False),
        _slot("calf", "accessory", BLOCK_ADDONS, required=False),
    ],
}

TEMPLATE_FULL_BODY_C = {
    "key": "full_body_c",
    "name_en": "Full Body C (Unilateral / carry focus)",
    "slots": [
        _slot("anti_rotation", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("lunge", "primary", BLOCK_MAIN, prefer_unilateral=True),
        _slot("pull_h", "secondary", BLOCK_MAIN, allow_patterns=["pull_v"]),
        _slot("push_v", "secondary", BLOCK_MAIN, allow_patterns=["push_h"]),
        _slot("carry", "secondary", BLOCK_MAIN, required=False),
        _slot("anti_extension", "accessory", BLOCK_ADDONS, required=False),
        _slot("calf", "accessory", BLOCK_ADDONS, required=False),
    ],
}

# Odľahčená šablóna - použije sa, keď je session tesne pred/po kvalitnom
# behu alebo pri health restriction. Žiadne ťažké zložené cviky nôh.
TEMPLATE_MAINTENANCE = {
    "key": "maintenance",
    "name_en": "Maintenance / Prehab",
    "slots": [
        _slot("anti_rotation", "prehab", BLOCK_ACTIVATION, required=False),
        _slot("hinge", "prehab", BLOCK_ACTIVATION, required=False),

        _slot("pull_h", "accessory", BLOCK_MAIN, allow_patterns=["pull_v"]),
        _slot("push_v", "accessory", BLOCK_MAIN, allow_patterns=["push_h"]),
        _slot("anti_extension", "accessory", BLOCK_MAIN, required=False),

        _slot("calf", "prehab", BLOCK_ADDONS, required=False),
    ],
}

ALL_TEMPLATES = {
    tpl["key"]: tpl
    for tpl in (
        TEMPLATE_FULL_BODY,
        TEMPLATE_FULL_BODY_A,
        TEMPLATE_FULL_BODY_B,
        TEMPLATE_FULL_BODY_C,
        TEMPLATE_LOWER,
        TEMPLATE_UPPER,
        TEMPLATE_MAINTENANCE,
    )
}


# ------------------------------------------------------------
# VÝBER SPLITU
# ------------------------------------------------------------

def get_week_split(sessions_per_week: int) -> List[str]:
    """
    Vráti poradie šablón pre daný týždeň.

    Vytrvalci dostávajú full body varianty aj pri 3x/týždeň - nohy sú
    pre beh najdôležitejšie a upper/lower split by znamenal, že v upper
    dni sa nohy vôbec nezaťažia. Až pri 4+ má zmysel klasický split.
    """
    n = max(0, int(sessions_per_week or 0))

    if n <= 0:
        return []
    if n == 1:
        return [TEMPLATE_FULL_BODY["key"]]
    if n == 2:
        return [TEMPLATE_FULL_BODY_A["key"], TEMPLATE_FULL_BODY_B["key"]]
    if n == 3:
        return [
            TEMPLATE_FULL_BODY_A["key"],
            TEMPLATE_FULL_BODY_B["key"],
            TEMPLATE_FULL_BODY_C["key"],
        ]
    # 4+ : striedavo lower/upper, doplnené full body pri nepárnom počte
    out: List[str] = []
    for i in range(n):
        out.append(TEMPLATE_LOWER["key"] if i % 2 == 0 else TEMPLATE_UPPER["key"])
    return out


def get_template(template_key: str) -> Dict[str, Any]:
    """Vráti šablónu podľa kľúča, fallback na full body."""
    return ALL_TEMPLATES.get(template_key, TEMPLATE_FULL_BODY)


def pick_template_for_session(
    *,
    sessions_per_week: int,
    session_index_in_week: int,
    force_maintenance: bool = False,
) -> Dict[str, Any]:
    """
    Vyberie šablónu pre konkrétnu session v týždni.

    session_index_in_week: 0-based poradie tejto silovej session v týždni.
    force_maintenance: použije odľahčenú šablónu bez ohľadu na split
        (zdravotné obmedzenie, alebo session tesne pri kvalitnom behu).
    """
    if force_maintenance:
        return TEMPLATE_MAINTENANCE

    split = get_week_split(sessions_per_week)
    if not split:
        return TEMPLATE_MAINTENANCE

    key = split[int(session_index_in_week) % len(split)]
    return get_template(key)


def trim_slots_to_duration(
    slots: List[Dict[str, Any]],
    estimated_durations_s: List[int],
    target_duration_min: int,
) -> List[Dict[str, Any]]:
    """
    Oreže voliteľné sloty, ak by session presiahla cieľovú dĺžku.

    Cieľ sa vzťahuje na activation + strength_main_part (add_ons sú bonus
    navyše - viď rozhodnutie v prompts). Odoberajú sa najprv sloty
    s required=False, a to od konca (posledné sú najmenej dôležité).
    Required sloty sa nikdy neodoberú - radšej session mierne presiahne
    cieľ, než by chýbal základný pohybový vzor.
    """
    target_s = int(target_duration_min) * 60

    def _core_total(idx_set: set) -> int:
        return sum(
            d
            for i, (s, d) in enumerate(zip(slots, estimated_durations_s))
            if i in idx_set and s["block"] in (BLOCK_ACTIVATION, BLOCK_MAIN)
        )

    keep = set(range(len(slots)))

    # odoberáme voliteľné sloty od konca, kým sme nad cieľom
    optional_idx = [
        i for i, s in enumerate(slots) if not s["required"]
    ]
    for i in reversed(optional_idx):
        if _core_total(keep) <= target_s:
            break
        keep.discard(i)

    return [s for i, s in enumerate(slots) if i in keep]
