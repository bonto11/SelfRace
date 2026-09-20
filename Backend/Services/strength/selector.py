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
  5. rep_suitability - hodí sa cvik na daný tréningový cieľ
  6. pattern        - sedí na slot (alebo na jeho allow_patterns)

Čo prejde, sa skóruje a berie sa najvyšší. Skóre rieši rotáciu:
  - primary cviky sú "sticky" - ak sa nedávno cvičili, dostanú BONUS
    (progresívne preťaženie potrebuje opakovanú expozíciu, inak sa
    nedá merať progres ani pridávať váhu)
  - accessory naopak dostanú PENALTU, ak boli nedávno - tie rotujeme
    kvôli variabilite a pokrytiu slabších miest
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

from Configs.strength_catalog import STRENGTH_EXERCISE_CATALOG, CATALOG_BY_ID
from Services.strength.schemes import (
    LEVEL_BEGINNER,
    LEVEL_INTERMEDIATE,
    LEVEL_ADVANCED,
    GOAL_GENERAL_RESILIENCE,
    get_scheme,
    estimate_exercise_duration_s,
)
from Services.strength.templates import (
    BLOCK_ACTIVATION,
    BLOCK_MAIN,
    BLOCK_ADDONS,
    trim_slots_to_duration,
)

_SKILL_ORDER = {"low": 0, "med": 1, "high": 2}
_FATIGUE_ORDER = {"low": 0, "med": 1, "high": 2}
_ECCENTRIC_ORDER = {"low": 0, "med": 1, "high": 2}

# Max skill_demand, ktorý athlete danej úrovne dostane
_MAX_SKILL_BY_LEVEL = {
    LEVEL_BEGINNER: "low",
    LEVEL_INTERMEDIATE: "med",
    LEVEL_ADVANCED: "high",
}

# Ako dlho spätne sa cvik počíta ako "nedávno cvičený"
RECENT_WINDOW_DAYS = 21

# Ako dlho drží primary cvik svoju pozíciu (mezocyklus)
PRIMARY_STICKY_DAYS = 42


# ============================================================
# FILTRE
# ============================================================

def _equipment_ok(
    exercise: Dict[str, Any],
    available_equipment: List[str],
    equipment_mode: Optional[str],
) -> bool:
    """Rovnaká logika ako v coach_strength_mapper, aby sa správanie nelíšilo."""
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
    """Cvik vypadne, ak má kontraindikáciu na niektoré aktívne zranenie."""
    if not injury_areas:
        return True
    contra = set(exercise.get("contraindications") or [])
    return not (contra & injury_areas)


def _skill_ok(exercise: Dict[str, Any], level: str) -> bool:
    max_skill = _MAX_SKILL_BY_LEVEL.get(level, "med")
    ex_skill = exercise.get("skill_demand") or "low"
    return _SKILL_ORDER.get(ex_skill, 0) <= _SKILL_ORDER.get(max_skill, 1)


def _goal_ok(exercise: Dict[str, Any], goal: str) -> bool:
    """
    Cvik sa musí hodiť na daný cieľ. Mapujeme general_resilience na
    hypertrophy+endurance, lebo pre vytrvalcov je to presne ten mix.
    """
    suitability = set(exercise.get("rep_suitability") or [])
    if not suitability:
        return True

    if goal == GOAL_GENERAL_RESILIENCE:
        return bool(suitability & {"hypertrophy", "endurance", "strength"})
    return goal in suitability


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
    """
    Vyššie skóre = vhodnejší cvik. Skóre nikdy nerozhoduje o tom, či je
    cvik povolený - to už vyriešili filtre. Rieši len "ktorý z povolených".
    """
    score = 0.0

    # --- presná zhoda vzoru je lepšia než fallback ---
    if exercise.get("pattern") == slot["pattern"]:
        score += 20.0

    # --- tier zhoda: primary slot chce primary cvik ---
    tier = exercise.get("tier")
    if tier == slot["tier"]:
        score += 25.0
    elif slot["tier"] == "primary" and tier == "secondary":
        score += 10.0  # akceptovateľný ústupok
    elif slot["tier"] == "accessory" and tier in ("secondary", "prehab"):
        score += 8.0

    # --- záťažové cviky pri dostupnom vybavení ---
    if prefer_loaded and exercise.get("load_type") != "bodyweight":
        score += 15.0
    if prefer_loaded and exercise.get("load_type") == "bodyweight":
        score -= 10.0

    # --- šport-špecifický dôraz ---
    tags = set(exercise.get("sport_tags") or [])
    if tags & sport_emphasis:
        score += 12.0

    # --- unilaterálne, ak slot žiada ---
    if slot.get("prefer_unilateral") and exercise.get("unilateral"):
        score += 10.0

    # --- ROTÁCIA: primary sticky, accessory rotate ---
    if last_used_days is not None:
        if slot["tier"] == "primary":
            # Držíme ten istý cvik počas mezocyklu - inak sa nedá merať progres
            if last_used_days <= PRIMARY_STICKY_DAYS:
                score += 30.0
        else:
            # Accessory rotujeme - čerstvo cvičené penalizujeme
            if last_used_days <= 7:
                score -= 18.0
            elif last_used_days <= RECENT_WINDOW_DAYS:
                score -= 8.0
            else:
                score += 5.0
    else:
        # Nikdy necvičené: pre accessory je to plus (variabilita),
        # pre primary mierne mínus (nemáme referenčnú váhu)
        score += 6.0 if slot["tier"] != "primary" else -4.0

    # --- únava a excentrická záťaž voči behu ---
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
    """
    Z logov (strength_sessions rows) vyrobí mapu exercise_id -> dni od
    posledného použitia. Berie len cviky, kde bola reálne zapísaná aspoň
    jedna pracovná séria - naplánovaný, ale neodcvičený cvik nič nehovorí
    o tom, čo athlete reálne robil.
    """
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
) -> Dict[str, Any]:
    """
    Naplní sloty šablóny konkrétnymi cvikmi a priradí im schému.

    avoid_high_eccentric / avoid_high_fatigue: nastav True, keď session
    susedí s kvalitným behom - vysoká excentrická záťaž zhoršuje bežeckú
    ekonomiku až na 8 h a svalové poškodenie pretrváva dlhšie.

    Vracia:
      {
        "template_key": str,
        "exercises": [ {exercise_id, block, order_index, planned{...}, ...} ],
        "estimated_duration_min": int,
        "warnings": [str]          # nenaplnené required sloty a pod.
      }
    """
    available_equipment = available_equipment or []
    injury_areas = injury_areas or set()
    disliked = set(disliked_exercises or [])
    sport_emphasis = sport_emphasis or {"general"}
    usage_map = usage_map or {}

    prefer_loaded = equipment_mode in ("full_gym", "minimal")

    # --- 1) predfiltruj katalóg raz, nie pre každý slot ---
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
        if not _goal_ok(ex, goal):
            continue
        candidates.append(ex)

    # --- 2) pre každý slot vyber najlepšieho kandidáta ---
    slots = list(template.get("slots") or [])
    chosen: List[Optional[Dict[str, Any]]] = []
    used_ids: Set[str] = set()
    warnings: List[str] = []

    for slot in slots:
        pool = [
            ex
            for ex in candidates
            if ex["id"] not in used_ids and _pattern_matches(ex, slot)
        ]

        if not pool:
            chosen.append(None)
            if slot["required"]:
                warnings.append(
                    f"no_exercise_for_required_slot:{slot['pattern']}/{slot['tier']}"
                )
            continue

        best = max(
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
        chosen.append(best)
        used_ids.add(best["id"])

    # --- 3) priraď schémy a odhadni čas ---
    schemes: List[Optional[Dict[str, Any]]] = []
    durations: List[int] = []
    for slot, ex in zip(slots, chosen):
        if ex is None:
            schemes.append(None)
            durations.append(0)
            continue
        sch = get_scheme(
            goal=goal, tier=slot["tier"], level=level, is_deload=is_deload
        )
        schemes.append(sch)
        durations.append(estimate_exercise_duration_s(sch))

    # --- 4) orež voliteľné sloty na cieľovú dĺžku ---
    #     (trim pracuje nad indexami, preto si držíme trojicu pohromade)
    triples = [
        (slot, ex, sch, dur)
        for slot, ex, sch, dur in zip(slots, chosen, schemes, durations)
        if ex is not None
    ]

    kept_slots = trim_slots_to_duration(
        [t[0] for t in triples],
        [t[3] for t in triples],
        target_duration_min,
    )
    kept_ids = {id(s) for s in kept_slots}
    triples = [t for t in triples if id(t[0]) in kept_ids]

    # --- 5) výstup ---
    exercises: List[Dict[str, Any]] = []
    for order, (slot, ex, sch, _dur) in enumerate(triples):
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

    core_s = sum(
        d
        for (slot, _ex, _sch, d) in triples
        if slot["block"] in (BLOCK_ACTIVATION, BLOCK_MAIN)
    )
    total_s = sum(d for (_slot, _ex, _sch, d) in triples)

    return {
        "template_key": template.get("key"),
        "template_name_en": template.get("name_en"),
        "exercises": exercises,
        "estimated_core_duration_min": int(round(core_s / 60)),
        "estimated_total_duration_min": int(round(total_s / 60)),
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
    target_duration_min: int = 60,
    force_maintenance: bool = False,
    avoid_high_eccentric: bool = False,
    avoid_high_fatigue: bool = False,
) -> Dict[str, Any]:
    """
    Vysokoúrovňový vstupný bod: z nastavení athléta poskladá hotovú
    silovú session. Toto volá builder pred odoslaním do AI.
    """
    from Services.strength.templates import pick_template_for_session
    from Services.strength.schemes import is_deload_week

    template = pick_template_for_session(
        sessions_per_week=sessions_per_week,
        session_index_in_week=session_index_in_week,
        force_maintenance=force_maintenance,
    )

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
    )
