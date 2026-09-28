# Services/strength/selector.py
"""
Deterministický výber konkrétnych cvikov do slotov zo šablóny.

Toto je vrstva 2 trojvrstvového modelu: šablóna (templates.py) povie, AKÝ
slot treba naplniť (pattern + tier), selector rozhodne, KTORÝ cvik to bude.
AI do tohto vôbec nezasahuje - dostane už hotový zoznam a robí len coaching
vrstvu (názvy, poznámky, cueing).

Poradie filtrov je tvrdé (cvik musí prejsť všetkými):
  1. equipment      - má athlete čím cvičiť
  2. contraindications - aktívne zranenia
  3. disliked       - explicitne odmietnuté cviky
  4. skill_demand   - technická náročnosť vs úroveň athléta
  5. pattern        - sedí na slot (alebo na jeho allow_patterns)
  6. rep_suitability - hodí sa cvik na rozsah opakovaní, ktorý mu schéma dá
     (schéma vychádza z cieľa, takže toto je zároveň filter cieľa)

Čo prejde, sa skóruje a berie sa najvyšší. Skóre rieši rotáciu:
  - primary cviky sú "sticky" (progresia potrebuje opakovanú expozíciu)
  - accessory rotujú (variabilita)

🌟 v3 - ROZPOČET TVRDÝCH SÉRIÍ NAMIESTO DOPĹŇANIA DO ČASU
  v2 dopĺňala session sériami, kým nedosiahla cieľovú dĺžku. Výsledok:
  25 tvrdých sérií, z toho 12 ťažké nohy - dvojnásobok toho, čo vytrvalec
  potrebuje, a únava do behov. Teraz:
    - objem riadi SESSION_HARD_SET_BUDGET (tvrdé = pracovné série
      v aktivácii + hlavnej časti okrem prehab; rozcvičovacie série a
      doplnky sa nerátajú),
    - nohy majú vlastný strop LOWER_BODY_HARD_SET_CAP (drep/hinge/výpady),
    - dĺžka z prefs je HORNÁ HRANICA, nie cieľ,
    - pri prekročení sa najprv vyhodia sloty s najnižšou trim_priority,
      potom sa uberajú série, primary cvik ostane najdlhšie,
    - hlavný cvik dostane min. PRIMARY_MIN_SETS sérií (progresívny impulz),
    - volume_factor (tapering pred pretekmi) a deload znižujú rozpočet
      a session sa vtedy nedopĺňa.
  Heuristika rozpočtu: prehľady o sile u vytrvalcov (Rønnestad & Mujika
  2014, Blagrove a kol. 2018) typicky 4-6 cvikov x 2-4 série, 2-3x týždenne.
  Samotné číslo 16 je odvodené z toho, nie z jednej štúdie.

🌟 PRESNEJŠÍ ODHAD ČASU
  - SESSION_WARMUP_S: všeobecná rozcvička pred tréningom,
  - PRIMARY_RAMP_S: rozcvičovacie série pred hlavným cvikom so záťažou,
  - jednostranné cviky (unilateral) rátajú prácu na obe strany.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Set

from Configs.strength_catalog import STRENGTH_EXERCISE_CATALOG
from Services.strength.schemes import (
    LEVEL_BEGINNER,
    LEVEL_INTERMEDIATE,
    LEVEL_ADJUSTMENTS,
    GOAL_GENERAL_RESILIENCE,
    GOAL_MAX_STRENGTH,
    GOAL_HYPERTROPHY,
    GOAL_STRENGTH_ENDURANCE,
    GOAL_POWER,
    DELOAD_SETS_MULTIPLIER,
    get_scheme,
    is_deload_week,
    _min_reps_from_range,
)
from Services.strength.templates import (
    BLOCK_ACTIVATION,
    BLOCK_MAIN,
    BLOCK_ADDONS,
    _slot,
    pick_template_for_session,
)
from Services.strength.sport_profiles import apply_profile_to_template

_SKILL_ORDER = {"low": 0, "med": 1, "high": 2}
_FATIGUE_ORDER = {"low": 0, "med": 1, "high": 2}
_ECCENTRIC_ORDER = {"low": 0, "med": 1, "high": 2}

_BLOCK_RANK = {BLOCK_ACTIVATION: 0, BLOCK_MAIN: 1, BLOCK_ADDONS: 2}
_TIER_RANK = {"primary": 0, "secondary": 1, "accessory": 2, "prehab": 3}

# Bloky, ktoré sa rátajú do rozpočtu aj do dĺžky jadra (add_ons sú navyše)
_CORE_BLOCKS = (BLOCK_ACTIVATION, BLOCK_MAIN)

# Ako dlho spätne sa cvik počíta ako "nedávno cvičený"
RECENT_WINDOW_DAYS = 21
# Ako dlho drží primary cvik svoju pozíciu (mezocyklus)
PRIMARY_STICKY_DAYS = 42

# ------------------------------------------------------------
# 🌟 ROZPOČET OBJEMU
# ------------------------------------------------------------
# Tvrdé série na session (aktivácia + hlavná časť, bez prehab).
SESSION_HARD_SET_BUDGET = {
    GOAL_GENERAL_RESILIENCE: 16,
    GOAL_MAX_STRENGTH: 16,
    GOAL_STRENGTH_ENDURANCE: 16,
    GOAL_POWER: 14,
    GOAL_HYPERTROPHY: 20,
}
# Strop tvrdých sérií na ťažké nohy (drep/hinge/výpady) v jednej session -
# aby sa dalo deň po tom behať. Plyometria a lýtka sa sem nerátajú.
LOWER_BODY_HARD_SET_CAP = {
    GOAL_GENERAL_RESILIENCE: 8,
    GOAL_MAX_STRENGTH: 9,
    GOAL_STRENGTH_ENDURANCE: 8,
    GOAL_POWER: 8,
    GOAL_HYPERTROPHY: 10,
}
LOWER_HEAVY_PATTERNS = {"squat", "hinge", "lunge"}
UPPER_PATTERNS = {"push_h", "push_v", "pull_h", "pull_v"}

# Hlavný cvik: min. 4 pracovné série (okrem začiatočníka/deloadu/taperingu).
PRIMARY_MIN_SETS = 4
# Pri uberaní sérií nejdeme pod 2 (1 séria je už len "prítomnosť" cviku).
MIN_SETS_ON_REDUCE = 2
# Max sérií na cvik pri dopĺňaní (začiatočník o 1 menej).
SET_CAPS = {"primary": 5, "secondary": 4, "accessory": 3, "prehab": 3}
MAX_MAIN_EXERCISES = 7
MAX_ADDON_EXERCISES = 3

# Trim priority: nižšie = vyhodí sa skôr. Povinné sloty sa nevyhadzujú.
TRIM_PRIORITY_REQUIRED = 9
TRIM_PRIORITY_OPTIONAL_DEFAULT = 5
TRIM_PRIORITY_FILLER = 2

# Všeobecné vzory na doplnenie, ak je session pod rozpočtom (napr. málo
# vybavenia) a šport profil nič neponúkne.
DEFAULT_FILL_PATTERNS = ["lunge", "pull_v", "hinge", "push_h", "pull_h", "push_v", "squat", "carry"]

# ------------------------------------------------------------
# 🌟 ODHAD ČASU
# ------------------------------------------------------------
SESSION_WARMUP_S = 360      # 6 min všeobecná rozcvička
PRIMARY_RAMP_S = 180        # ~3 min rozcvičovacie série pred hlavným cvikom
_RAMP_LOAD_TYPES = {"barbell", "dumbbell", "kettlebell", "machine"}

SHORT_SESSION_WARNING_MIN = 25

# ------------------------------------------------------------
# 🌟 ČASOVÉ / VZDIALENOSTNÉ CVIKY (measure z katalógu)
# ------------------------------------------------------------
# Plank ani dead hang sa nerobia "na 12 opakovaní" - katalóg má pole
# measure (reps|time|distance) a podľa neho sa prepíše rozsah zo schémy.
# Rozsah závisí od tieru: prehab/accessory kratšie, secondary dlhšie.
TIME_RANGE_BY_TIER = {
    "prehab": "30-45s",
    "accessory": "30-45s",
    "secondary": "40-60s",
    "primary": "40-60s",
}
DISTANCE_RANGE_BY_TIER = {
    "prehab": "20-30m",
    "accessory": "20-30m",
    "secondary": "30-50m",
    "primary": "30-50m",
}
# Odhad času pri vzdialenostnom cviku (sled push/pull, ~30 m)
DISTANCE_WORK_S = 35


# ============================================================
# FILTRE
# ============================================================

def _equipment_ok(
    exercise: Dict[str, Any],
    available_equipment: List[str],
    equipment_mode: Optional[str],
) -> bool:
    if equipment_mode == "full_gym":
        return True

    eqs = exercise.get("equipment") or []
    if "none" in eqs:
        return True

    if not available_equipment:
        home_basic = {"none", "resistance_bands", "trx", "abwheel", "pullup_bar"}
        return any(e in home_basic for e in eqs)

    return any(e in available_equipment for e in eqs)


def _injury_ok(exercise: Dict[str, Any], injury_areas: Set[str]) -> bool:
    if not injury_areas:
        return True
    contra = set(exercise.get("contraindications") or [])
    return not (contra & injury_areas)


def _skill_ok(exercise: Dict[str, Any], level: str) -> bool:
    """max_skill_demand sa číta zo schemes.LEVEL_ADJUSTMENTS (jeden zdroj pravdy)."""
    adj = LEVEL_ADJUSTMENTS.get(level) or LEVEL_ADJUSTMENTS[LEVEL_INTERMEDIATE]
    max_skill = adj.get("max_skill_demand") or "high"
    ex_skill = exercise.get("skill_demand") or "low"
    return _SKILL_ORDER.get(ex_skill, 0) <= _SKILL_ORDER.get(max_skill, 2)


# 🌟 ODSTRÁNENÉ: _goal_ok. Porovnával cieľ (napr. "max_strength",
# "strength_endurance") priamo s rep_suitability v katalógu ("strength",
# "endurance", ...) - tie hodnoty sa nikdy nezhodovali, takže pri cieli
# Max sila / Silová vytrvalosť vypadli takmer všetky cviky. Vhodnosť cviku
# teraz rieši _reps_ok per slot: schéma (a teda rozsah opakovaní) sa
# odvíja od cieľa, takže je to presnejší filter na tú istú vec.


def _rep_classes_for_reps(reps: Any) -> Optional[Set[str]]:
    """Ktoré rep_suitability triedy sa hodia na rozsah opakovaní zo schémy."""
    lo = _min_reps_from_range(str(reps or ""))
    if lo is None:
        return None
    if lo <= 5:
        return {"strength", "power"}
    if lo <= 8:
        return {"strength", "hypertrophy", "power"}
    if lo < 12:
        return {"hypertrophy", "endurance", "strength"}
    return {"endurance", "hypertrophy"}


def _reps_ok(exercise: Dict[str, Any], rep_classes: Optional[Set[str]]) -> bool:
    # 🌟 NOVÉ: časový/vzdialenostný cvik nemá zmysel filtrovať podľa rozsahu
    # opakovaní zo schémy - jeho rozsah sa aj tak prepíše (30-45s / 20-30m)
    if (exercise.get("measure") or "reps") != "reps":
        return True
    if not rep_classes:
        return True
    suitability = set(exercise.get("rep_suitability") or [])
    if not suitability:
        return True
    return bool(suitability & rep_classes)


def _pattern_matches(exercise: Dict[str, Any], slot: Dict[str, Any]) -> bool:
    pat = exercise.get("pattern")
    if pat == slot["pattern"]:
        return True
    return pat in (slot.get("allow_patterns") or [])


# ============================================================
# SKÓROVANIE
# ============================================================

def _days_since(iso_date: Optional[str]) -> Optional[int]:
    if not iso_date:
        return None
    try:
        d = date.fromisoformat(str(iso_date)[:10])
        return (date.today() - d).days
    except Exception:
        return None


def _score_exercise(
    exercise: Dict[str, Any],
    slot: Dict[str, Any],
    *,
    last_used_days: Optional[int],
    sport_emphasis: Set[str],
    prefer_loaded: bool,
    avoid_high_eccentric: bool,
    avoid_high_fatigue: bool,
) -> float:
    score = 0.0

    if exercise.get("pattern") == slot["pattern"]:
        score += 20.0

    tier = exercise.get("tier")
    if tier == slot["tier"]:
        score += 25.0
    elif slot["tier"] == "primary" and tier == "secondary":
        score += 10.0
    elif slot["tier"] == "accessory" and tier in ("secondary", "prehab"):
        score += 8.0

    if prefer_loaded and exercise.get("load_type") != "bodyweight":
        score += 15.0
    if prefer_loaded and exercise.get("load_type") == "bodyweight":
        score -= 10.0

    tags = set(exercise.get("sport_tags") or [])
    if tags & sport_emphasis:
        score += 12.0

    if slot.get("prefer_unilateral") and exercise.get("unilateral"):
        score += 10.0

    if last_used_days is not None:
        if slot["tier"] == "primary":
            if last_used_days <= PRIMARY_STICKY_DAYS:
                score += 30.0
        else:
            if last_used_days <= 7:
                score -= 18.0
            elif last_used_days <= RECENT_WINDOW_DAYS:
                score -= 8.0
            else:
                score += 5.0
    else:
        score += 6.0 if slot["tier"] != "primary" else -4.0

    if avoid_high_eccentric:
        ecc = _ECCENTRIC_ORDER.get(exercise.get("eccentric_load") or "low", 0)
        score -= ecc * 12.0
    if avoid_high_fatigue:
        fat = _FATIGUE_ORDER.get(exercise.get("fatigue_cost") or "low", 0)
        score -= fat * 10.0

    return score


# ============================================================
# HISTÓRIA
# ============================================================

def build_usage_map(recent_sessions: List[Dict[str, Any]]) -> Dict[str, int]:
    """exercise_id -> dni od posledného reálne odcvičeného použitia."""
    out: Dict[str, int] = {}

    for row in recent_sessions or []:
        log = row.get("log")
        if not isinstance(log, dict):
            continue
        d = _days_since(row.get("session_date"))
        if d is None:
            continue

        for ex in log.get("exercises") or []:
            if not isinstance(ex, dict):
                continue
            ex_id = ex.get("exercise_id")
            if not ex_id:
                continue
            has_work = any(
                isinstance(s, dict) and not s.get("is_warmup") and s.get("reps")
                for s in (ex.get("sets") or [])
            )
            if not has_work:
                continue
            prev = out.get(ex_id)
            if prev is None or d < prev:
                out[ex_id] = d

    return out


# ============================================================
# METRIKY SESSION
# ============================================================

def _is_core(it: Dict[str, Any]) -> bool:
    return it["slot"]["block"] in _CORE_BLOCKS


def _is_hard(it: Dict[str, Any]) -> bool:
    return _is_core(it) and it["slot"]["tier"] != "prehab"


def _is_lower_heavy(it: Dict[str, Any]) -> bool:
    return _is_hard(it) and it["ex"].get("pattern") in LOWER_HEAVY_PATTERNS


def _hard_sets(items: List[Dict[str, Any]]) -> int:
    return sum(int(it["sch"]["sets"]) for it in items if _is_hard(it))


def _lower_sets(items: List[Dict[str, Any]]) -> int:
    return sum(int(it["sch"]["sets"]) for it in items if _is_lower_heavy(it))


def _core_seconds(items: List[Dict[str, Any]]) -> int:
    return SESSION_WARMUP_S + sum(it["dur"] for it in items if _is_core(it))


def _work_per_set_s(sch: Dict[str, Any]) -> int:
    reps = str(sch.get("reps") or "").strip()
    lo = _min_reps_from_range(reps) or 10
    if reps.endswith("s"):
        return max(15, lo)          # časový cvik: "30-45s" = 30 s práce
    if reps.endswith("m"):
        return DISTANCE_WORK_S      # vzdialenostný cvik (sled)
    return max(20, int(lo * 3.5))   # ~3.5 s na opakovanie vrátane setupu


def _item_duration(ex: Dict[str, Any], sch: Dict[str, Any], slot: Dict[str, Any]) -> int:
    """Odhad času cviku: práca + pauzy + presun, obe strany, rozcvičovacie série."""
    sets = int(sch.get("sets") or 0)
    if sets <= 0:
        return 0
    work = _work_per_set_s(sch)
    rest = int(sch.get("rest_s") or 60)
    total = sets * work + (sets - 1) * rest + 45
    if ex.get("unilateral"):
        total += sets * work
    if slot["tier"] == "primary" and ex.get("load_type") in _RAMP_LOAD_TYPES:
        total += PRIMARY_RAMP_S
    return int(total)


# ============================================================
# HLAVNÝ VÝBER
# ============================================================

def select_exercises_for_template(
    *,
    template: Dict[str, Any],
    goal: str,
    level: str = LEVEL_INTERMEDIATE,
    available_equipment: Optional[List[str]] = None,
    equipment_mode: Optional[str] = None,
    injury_areas: Optional[Set[str]] = None,
    disliked_exercises: Optional[List[str]] = None,
    sport_emphasis: Optional[Set[str]] = None,
    usage_map: Optional[Dict[str, int]] = None,
    target_duration_min: int = 60,
    is_deload: bool = False,
    avoid_high_eccentric: bool = False,
    avoid_high_fatigue: bool = False,
    fill_patterns: Optional[List[str]] = None,
    volume_factor: float = 1.0,
    upper_main_max_sets: Optional[int] = None,
    trim_boost: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    """
    Naplní sloty šablóny cvikmi, priradí schémy a session prispôsobí
    rozpočtu tvrdých sérií (strop dĺžky = target_duration_min).

    volume_factor: 🌟 NOVÉ - násobok rozpočtu (napr. 0.6 týždeň pretekov).
    Intenzita (váha, opakovania) ostáva, uberajú sa série.
    upper_main_max_sets: 🌟 NOVÉ - strop sérií pre vedľajšie cviky hornej
    časti (profil "posilka na beh": horná časť len na udržanie, 2 série).
    trim_boost: 🌟 NOVÉ - {pattern: trim_priority} pre voliteľné sloty
    šablóny (profil "posilka na beh" drží výpady/hinge dlhšie než ostatné).
    """
    trim_boost = trim_boost or {}
    available_equipment = available_equipment or []
    injury_areas = injury_areas or set()
    disliked = set(disliked_exercises or [])
    sport_emphasis = sport_emphasis or {"general"}
    usage_map = usage_map or {}
    volume_factor = max(0.3, min(1.0, float(volume_factor or 1.0)))

    prefer_loaded = equipment_mode in ("full_gym", "minimal")
    ceiling_s = max(0, int(target_duration_min or 0)) * 60
    reduced_week = is_deload or volume_factor < 1.0
    deload_mult = DELOAD_SETS_MULTIPLIER if is_deload else 1.0

    budget = max(4, int(round(SESSION_HARD_SET_BUDGET.get(goal, 16) * volume_factor * deload_mult)))
    lower_cap = max(3, int(round(LOWER_BODY_HARD_SET_CAP.get(goal, 8) * volume_factor * deload_mult)))

    # --- 1) predfiltruj katalóg ---
    candidates: List[Dict[str, Any]] = []
    for ex in STRENGTH_EXERCISE_CATALOG:
        if ex["id"] in disliked:
            continue
        if not _equipment_ok(ex, available_equipment, equipment_mode):
            continue
        if not _injury_ok(ex, injury_areas):
            continue
        if not _skill_ok(ex, level):
            continue
        candidates.append(ex)

    used_ids: Set[str] = set()
    warnings: List[str] = []

    def _scheme_for_slot(slot: Dict[str, Any]) -> Dict[str, Any]:
        sch = dict(get_scheme(goal=goal, tier=slot["tier"], level=level, is_deload=is_deload))
        override = slot.get("scheme_override")
        if override:
            sets = int(override.get("sets", sch["sets"]))
            if is_deload:
                sets = max(1, int(round(sets * DELOAD_SETS_MULTIPLIER)))
            sch.update(override)
            sch["sets"] = sets
        elif (
            slot["tier"] == "primary"
            and level != LEVEL_BEGINNER
            and not reduced_week
        ):
            # 🌟 hlavný cvik = progresívny impulz, min. 4 pracovné série
            sch["sets"] = max(int(sch["sets"]), PRIMARY_MIN_SETS)
        if (
            upper_main_max_sets
            and slot["tier"] != "primary"
            and slot["block"] == BLOCK_MAIN
            and slot["pattern"] in UPPER_PATTERNS
        ):
            sch["sets"] = min(int(sch["sets"]), int(upper_main_max_sets))
        return sch

    def _choose(slot: Dict[str, Any], *, is_fill: bool = False) -> Optional[Dict[str, Any]]:
        pool = [
            ex for ex in candidates
            if ex["id"] not in used_ids and _pattern_matches(ex, slot)
        ]
        # 🌟 slot môže obmedziť typ záťaže (plyometria = len bodyweight
        # skoky, inak by vyhral assault bike, ktorý má v katalógu pattern jump)
        load_types = slot.get("load_types")
        if load_types:
            pool = [ex for ex in pool if ex.get("load_type") in load_types]
        # doplnkový cvik v hlavnej časti musí byť skutočný silový cvik
        if is_fill:
            pool = [ex for ex in pool if ex.get("tier") in ("primary", "secondary")]
        # cvik musí sedieť na rozsah opakovaní zo schémy (pri povinných
        # slotoch fallback na nefiltrovaný pool - radšej cvik než prázdny slot)
        rep_classes = _rep_classes_for_reps(_scheme_for_slot(slot).get("reps"))
        rep_pool = [ex for ex in pool if _reps_ok(ex, rep_classes)]
        if rep_pool or is_fill or not slot.get("required"):
            pool = rep_pool
        if not pool:
            return None
        return max(
            pool,
            key=lambda ex: _score_exercise(
                ex,
                slot,
                last_used_days=usage_map.get(ex["id"]),
                sport_emphasis=sport_emphasis,
                prefer_loaded=prefer_loaded,
                avoid_high_eccentric=avoid_high_eccentric,
                avoid_high_fatigue=avoid_high_fatigue,
            ),
        )

    def _make_item(slot: Dict[str, Any], ex: Dict[str, Any], pos: int) -> Dict[str, Any]:
        sch = _scheme_for_slot(slot)
        # 🌟 ZMENA: rozsah podľa measure z katalógu (bol natvrdo zoznam id)
        measure = ex.get("measure") or "reps"
        if measure == "time":
            sch["reps"] = TIME_RANGE_BY_TIER.get(slot["tier"], "30-45s")
        elif measure == "distance":
            sch["reps"] = DISTANCE_RANGE_BY_TIER.get(slot["tier"], "20-30m")
        trim = slot.get("trim_priority")
        if trim is None:
            if slot.get("required"):
                trim = TRIM_PRIORITY_REQUIRED
            else:
                trim = trim_boost.get(slot["pattern"], TRIM_PRIORITY_OPTIONAL_DEFAULT)
        return {
            "slot": slot,
            "ex": ex,
            "sch": sch,
            "dur": _item_duration(ex, sch, slot),
            "trim": int(trim),
            "pos": pos,
        }

    def _set_sets(it: Dict[str, Any], n: int) -> None:
        it["sch"] = {**it["sch"], "sets": int(n)}
        it["dur"] = _item_duration(it["ex"], it["sch"], it["slot"])

    # --- 2) naplň sloty šablóny (+ extra sloty profilu) ---
    items: List[Dict[str, Any]] = []
    for pos, slot in enumerate(list(template.get("slots") or [])):
        ex = _choose(slot)
        if ex is None:
            if slot.get("required"):
                warnings.append(f"no_exercise_for_required_slot:{slot['pattern']}/{slot['tier']}")
            continue
        used_ids.add(ex["id"])
        items.append(_make_item(slot, ex, pos))

    # doplnky: max MAX_ADDON_EXERCISES (v redukovanom týždni o 1 menej)
    addon_limit = MAX_ADDON_EXERCISES - (1 if reduced_week else 0)
    addons = [it for it in items if it["slot"]["block"] == BLOCK_ADDONS]
    if len(addons) > addon_limit:
        addons_sorted = sorted(addons, key=lambda it: (-it["trim"], it["pos"]))
        drop = {id(it) for it in addons_sorted[addon_limit:]}
        for it in items:
            if id(it) in drop:
                used_ids.discard(it["ex"]["id"])
        items = [it for it in items if id(it) not in drop]

    # --- 3) 🌟 zmenši session na rozpočet / strop nôh / strop dĺžky ---
    # Akcia s najnižšou "cenou" vyhráva: vyhodiť voliteľný slot = trim*10,
    # ubrať sériu = trim*10 - 5 (radšej uberieme sériu cviku, než by sme ho
    # vyhodili celý, ale cvik s nižšou prioritou vyhodíme skôr, než uberieme
    # sériu dôležitejšiemu). Primary sa uberá až úplne nakoniec.
    for _ in range(80):
        over_budget = _hard_sets(items) > budget
        over_lower = _lower_sets(items) > lower_cap
        over_time = ceiling_s > 0 and _core_seconds(items) > ceiling_s
        if not (over_budget or over_lower or over_time):
            break

        actions: List[tuple] = []
        for it in items:
            if not _is_core(it):
                continue
            relevant = (
                (over_budget and _is_hard(it))
                or (over_lower and _is_lower_heavy(it))
                or over_time
            )
            if not relevant:
                continue
            # pri prekročenom strope nôh uberáme najprv nohy
            lower_bonus = -3 if (over_lower and _is_lower_heavy(it)) else 0
            if not it["slot"].get("required"):
                actions.append((it["trim"] * 10 + lower_bonus, "drop", it))
            sets = int(it["sch"]["sets"])
            is_primary = it["slot"]["tier"] == "primary"
            min_sets = 3 if (is_primary and not reduced_week and level != LEVEL_BEGINNER) else MIN_SETS_ON_REDUCE
            if sets > min_sets and _is_hard(it):
                cost = (95 if is_primary else it["trim"] * 10 - 5) + lower_bonus
                actions.append((cost, "reduce", it))

        if not actions:
            warnings.append("session_over_budget_required_only")
            break

        actions.sort(key=lambda a: (a[0], -a[2]["pos"]))
        _cost, kind, target = actions[0]
        if kind == "drop":
            used_ids.discard(target["ex"]["id"])
            items = [it for it in items if it is not target]
        else:
            _set_sets(target, int(target["sch"]["sets"]) - 1)

    # --- 4) doplň, ak je session pod rozpočtom (nie v redukovanom týždni) ---
    if not reduced_week:
        cap_delta = -1 if level == LEVEL_BEGINNER else 0

        def _fits(add_hard: int, add_lower: int, add_s: int) -> bool:
            if _hard_sets(items) + add_hard > budget:
                return False
            if _lower_sets(items) + add_lower > lower_cap:
                return False
            if ceiling_s > 0 and _core_seconds(items) + add_s > ceiling_s:
                return False
            return True

        # 4a) ďalšie cviky na nepokryté vzory
        patterns: List[str] = []
        for p in list(fill_patterns or []) + DEFAULT_FILL_PATTERNS:
            if p not in patterns:
                patterns.append(p)
        next_pos = 1000
        for pat in patterns:
            main_items = [it for it in items if it["slot"]["block"] == BLOCK_MAIN]
            if len(main_items) >= MAX_MAIN_EXERCISES:
                break
            if any(it["ex"].get("pattern") == pat for it in main_items):
                continue
            fill_slot = {
                **_slot(pat, "secondary", BLOCK_MAIN, required=False),
                "trim_priority": TRIM_PRIORITY_FILLER,
            }
            ex = _choose(fill_slot, is_fill=True)
            if ex is None:
                continue
            item = _make_item(fill_slot, ex, next_pos)
            # skús plný počet sérií, ak sa nezmestí, tak menej (min. 2)
            placed = False
            for sets in range(int(item["sch"]["sets"]), MIN_SETS_ON_REDUCE - 1, -1):
                _set_sets(item, sets)
                add_lower = sets if pat in LOWER_HEAVY_PATTERNS else 0
                if _fits(sets, add_lower, item["dur"]):
                    placed = True
                    break
            if not placed:
                continue
            used_ids.add(ex["id"])
            items.append(item)
            next_pos += 1

        # 4b) série navyše (primary prvé)
        while True:
            progressed = False
            for it in sorted(
                (it for it in items if _is_hard(it) and it["slot"]["block"] == BLOCK_MAIN),
                key=lambda it: (_TIER_RANK.get(it["slot"]["tier"], 9), -it["trim"], it["pos"]),
            ):
                if it["slot"].get("scheme_override"):
                    continue  # plyometria má pevný nízky objem
                cap = SET_CAPS.get(it["slot"]["tier"], 3) + cap_delta
                if (
                    upper_main_max_sets
                    and it["slot"]["tier"] != "primary"
                    and it["slot"]["pattern"] in UPPER_PATTERNS
                ):
                    cap = min(cap, int(upper_main_max_sets))
                sets = int(it["sch"]["sets"])
                if sets >= cap:
                    continue
                new_sch = {**it["sch"], "sets": sets + 1}
                new_dur = _item_duration(it["ex"], new_sch, it["slot"])
                if not _fits(1, 1 if _is_lower_heavy(it) else 0, new_dur - it["dur"]):
                    continue
                _set_sets(it, sets + 1)
                progressed = True
                break  # po každej sérii znova od primary
            if not progressed:
                break

    if _core_seconds(items) < SHORT_SESSION_WARNING_MIN * 60 and not reduced_week:
        warnings.append("session_below_target_duration")

    # --- 5) výstup: blok -> v hlavnej časti plyometria prvá -> poradie šablóny ---
    items.sort(
        key=lambda it: (
            _BLOCK_RANK.get(it["slot"]["block"], 9),
            0 if it["slot"].get("order_first") else 1,
            it["pos"],
        )
    )

    exercises: List[Dict[str, Any]] = []
    for order, it in enumerate(items):
        slot, ex, sch = it["slot"], it["ex"], it["sch"]
        exercises.append(
            {
                "exercise_id": ex["id"],
                "name_en": ex["name_en"],
                "block": slot["block"],
                "order_index": order,
                "pattern": ex["pattern"],
                "tier": slot["tier"],
                "unilateral": bool(ex.get("unilateral")),
                "load_type": ex.get("load_type"),
                # 🌟 NOVÉ: pre zápis tréningu - ako sa cvik meria a či sa
                # kg zadávajú povinne (external) alebo voliteľne ako
                # prídavné závažie (bodyweight_plus)
                "measure": ex.get("measure") or "reps",
                "load_mode": ex.get("load_mode") or "external",
                "planned": {
                    "sets": sch["sets"],
                    "reps": sch["reps"],
                    "rest_s": sch["rest_s"],
                    "intensity_pct": sch.get("intensity_pct"),
                    "rir": sch.get("rir"),
                },
                "last_used_days_ago": usage_map.get(ex["id"]),
            }
        )

    core_s = _core_seconds(items)
    total_s = core_s + sum(it["dur"] for it in items if not _is_core(it))

    return {
        "template_key": template.get("key"),
        "template_name_en": template.get("name_en"),
        "sport_profile": template.get("sport_profile"),
        "exercises": exercises,
        "target_duration_min": int(target_duration_min or 0),
        "general_warmup_min": int(round(SESSION_WARMUP_S / 60)),
        "estimated_core_duration_min": int(round(core_s / 60)),
        "estimated_total_duration_min": int(round(total_s / 60)),
        "hard_sets": _hard_sets(items),
        "lower_body_hard_sets": _lower_sets(items),
        "hard_set_budget": budget,
        "volume_factor": volume_factor,
        "is_deload": is_deload,
        "warnings": warnings,
    }


def build_strength_session(
    *,
    sessions_per_week: int,
    session_index_in_week: int,
    goal: str,
    level: str = LEVEL_INTERMEDIATE,
    week_index: int = 1,
    recent_sessions: Optional[List[Dict[str, Any]]] = None,
    available_equipment: Optional[List[str]] = None,
    equipment_mode: Optional[str] = None,
    injury_areas: Optional[Set[str]] = None,
    disliked_exercises: Optional[List[str]] = None,
    sport_emphasis: Optional[Set[str]] = None,
    sport_profile: Optional[Dict[str, Any]] = None,
    target_duration_min: int = 60,
    force_maintenance: bool = False,
    avoid_high_eccentric: bool = False,
    avoid_high_fatigue: bool = False,
    volume_factor: float = 1.0,
) -> Dict[str, Any]:
    """
    Vysokoúrovňový vstupný bod: z nastavení athléta poskladá hotovú
    silovú session. Toto volá builder pred odoslaním do AI.

    sport_profile: profil z sport_profiles.build_sport_profile() - pridá
    extra sloty šablóne, dodá emphasis a vzory na dopĺňanie.
    volume_factor: 🌟 NOVÉ - zníženie objemu pred pretekmi (builder).
    """
    template = pick_template_for_session(
        sessions_per_week=sessions_per_week,
        session_index_in_week=session_index_in_week,
        force_maintenance=force_maintenance,
    )

    fill_patterns: List[str] = []
    if sport_profile:
        if not force_maintenance:
            template = apply_profile_to_template(template, sport_profile)
        if sport_emphasis is None:
            sport_emphasis = set(sport_profile.get("emphasis") or {"general"})
        fill_patterns = list(sport_profile.get("priority_patterns") or [])
        upper_main_max_sets = sport_profile.get("upper_main_max_sets")
        trim_boost = sport_profile.get("trim_boost")
    else:
        upper_main_max_sets = None
        trim_boost = None

    usage_map = build_usage_map(recent_sessions or [])

    return select_exercises_for_template(
        template=template,
        goal=goal,
        level=level,
        available_equipment=available_equipment,
        equipment_mode=equipment_mode,
        injury_areas=injury_areas,
        disliked_exercises=disliked_exercises,
        sport_emphasis=sport_emphasis,
        usage_map=usage_map,
        target_duration_min=target_duration_min,
        is_deload=is_deload_week(week_index),
        avoid_high_eccentric=avoid_high_eccentric,
        avoid_high_fatigue=avoid_high_fatigue,
        fill_patterns=fill_patterns,
        volume_factor=volume_factor,
        upper_main_max_sets=upper_main_max_sets,
        trim_boost=trim_boost,
    )