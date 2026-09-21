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

🌟 ZMENY (v2):
  - DOPĹŇANIE DO CIEĽOVEJ DĹŽKY: predtým sa session dala len orezať
    (trim_slots_to_duration), nikdy doplniť. Šablóna full_body_a má 4 hlavné
    sloty -> jadro vychádzalo ~27 min pri cieli 60 min (presne pôvodný
    problém "30-35 min namiesto 60"). Teraz sa po výbere dopĺňa:
      a) ďalšími cvikmi na nepokryté pohybové vzory (najprv šport profil,
         potom všeobecné), max MAX_MAIN_EXERCISES v hlavnej časti,
      b) potom sériami navyše (primary prvé), do SET_CAPS.
    Deload týždeň sa nedopĺňa - má byť zámerne kratší.
  - ŠPORT PROFIL: build_strength_session teraz aplikuje
    apply_profile_to_template (extra sloty ako grip/carry pre OCR). Predtým
    sa z profilu používal len sport_emphasis a extra sloty sa nikdy
    nepridali.
  - SKILL LIMIT: namiesto vlastnej tabuľky (_MAX_SKILL_BY_LEVEL, kde
    intermediate = max "med" -> drep s veľkou činkou úplne vypadol) sa číta
    max_skill_demand priamo zo schemes.LEVEL_ADJUSTMENTS - jeden zdroj pravdy.
  - Výstup je zoradený podľa bloku (aktivácia -> hlavná časť -> doplnky),
    aj keď extra sloty z profilu/doplňovania pribudli na koniec zoznamu.
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
    get_scheme,
    estimate_exercise_duration_s,
    is_deload_week,
)
from Services.strength.templates import (
    BLOCK_ACTIVATION,
    BLOCK_MAIN,
    BLOCK_ADDONS,
    _slot,
    pick_template_for_session,
    trim_slots_to_duration,
)
from Services.strength.sport_profiles import apply_profile_to_template

_SKILL_ORDER = {"low": 0, "med": 1, "high": 2}
_FATIGUE_ORDER = {"low": 0, "med": 1, "high": 2}
_ECCENTRIC_ORDER = {"low": 0, "med": 1, "high": 2}

_BLOCK_RANK = {BLOCK_ACTIVATION: 0, BLOCK_MAIN: 1, BLOCK_ADDONS: 2}
_TIER_RANK = {"primary": 0, "secondary": 1, "accessory": 2, "prehab": 3}

# Bloky, ktoré sa rátajú do cieľovej dĺžky (add_ons sú bonus navyše)
_CORE_BLOCKS = (BLOCK_ACTIVATION, BLOCK_MAIN)

# Ako dlho spätne sa cvik počíta ako "nedávno cvičený"
RECENT_WINDOW_DAYS = 21

# Ako dlho drží primary cvik svoju pozíciu (mezocyklus)
PRIMARY_STICKY_DAYS = 42

# 🌟 NOVÉ: parametre dopĺňania do cieľovej dĺžky
# Jadro >= 92 % cieľa sa berie ako "sedí" (60 min cieľ -> ~55 min stačí).
FILL_TOLERANCE = 0.92
# Doplnenie nesmie jadro natiahnuť viac ako 8 % nad cieľ.
OVERSHOOT_LIMIT = 1.08
# Max cvikov v hlavnej časti - nad 7 už kvalita sérií klesá.
MAX_MAIN_EXERCISES = 7
# Max sérií na cvik po doplnení (začiatočník o 1 menej).
SET_CAPS = {"primary": 5, "secondary": 4, "accessory": 4, "prehab": 3}
# Všeobecné vzory na doplnenie, ak šport profil nič neponúkne. Poradie =
# priorita (jednonožné a vertikálny ťah sú pre vytrvalcov najcennejšie).
DEFAULT_FILL_PATTERNS = ["lunge", "pull_v", "hinge", "push_h", "squat", "pull_h", "push_v", "carry"]
# Pod týmto podielom cieľa pridáme warning (aj po doplnení je session krátka,
# typicky kvôli obmedzenému vybaveniu alebo zraneniam).
SHORT_SESSION_WARNING_RATIO = 0.75


# ============================================================
# FILTRE
# ============================================================

def _equipment_ok(
    exercise: Dict[str, Any],
    available_equipment: List[str],
    equipment_mode: Optional[str],
) -> bool:
    """Rovnaká logika ako pôvodne v coach_strength_mapper."""
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
    """
    🌟 ZMENA: max_skill_demand sa číta zo schemes.LEVEL_ADJUSTMENTS (jeden
    zdroj pravdy). Predtým mal selector vlastnú tabuľku, kde intermediate =
    max "med", čo vyradilo barbell back squat, front squat aj conventional
    deadlift - stredne pokročilý athlete s full gym dostal leg press ako
    hlavný cvik na nohy.
    """
    adj = LEVEL_ADJUSTMENTS.get(level) or LEVEL_ADJUSTMENTS[LEVEL_INTERMEDIATE]
    max_skill = adj.get("max_skill_demand") or "high"
    ex_skill = exercise.get("skill_demand") or "low"
    return _SKILL_ORDER.get(ex_skill, 0) <= _SKILL_ORDER.get(max_skill, 2)


def _goal_ok(exercise: Dict[str, Any], goal: str) -> bool:
    """
    Cvik sa musí hodiť na daný cieľ. general_resilience akceptuje
    hypertrophy + endurance + strength, lebo pre vytrvalcov je to presne ten mix.
    """
    suitability = set(exercise.get("rep_suitability") or [])
    if not suitability:
        return True

    if goal == GOAL_GENERAL_RESILIENCE:
        return bool(suitability & {"hypertrophy", "endurance", "strength"})
    return goal in suitability


def _rep_classes_for_reps(reps: Any) -> Optional[Set[str]]:
    """
    🌟 NOVÉ: ktoré rep_suitability triedy sa hodia na rozsah opakovaní zo
    schémy. Bez toho selector dal napr. Turkish get-up (len "strength") do
    doplnkov so schémou 2x12-15, čo nedáva zmysel.
    None = rozsah sa nedá určiť -> nefiltrujeme.
    """
    try:
        lo = int(str(reps).split("-")[0].strip())
    except Exception:
        return None
    if lo <= 5:
        return {"strength", "power"}
    if lo <= 8:
        return {"strength", "hypertrophy", "power"}
    if lo < 12:
        return {"hypertrophy", "endurance", "strength"}
    return {"endurance", "hypertrophy"}


def _reps_ok(exercise: Dict[str, Any], rep_classes: Optional[Set[str]]) -> bool:
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

def _core_seconds(items: List[Dict[str, Any]]) -> int:
    return sum(it["dur"] for it in items if it["slot"]["block"] in _CORE_BLOCKS)


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
) -> Dict[str, Any]:
    """
    Naplní sloty šablóny konkrétnymi cvikmi, priradí im schému a session
    orezať/doplní na cieľovú dĺžku jadra (activation + strength_main_part).

    fill_patterns: 🌟 NOVÉ - pohybové vzory, ktorými sa prednostne dopĺňa
    krátka session (typicky priority_patterns zo šport profilu).

    avoid_high_eccentric / avoid_high_fatigue: nastav True, keď session
    susedí s kvalitným behom - vysoká excentrická záťaž zhoršuje bežeckú
    ekonomiku až na 8 h a svalové poškodenie pretrváva dlhšie.
    """
    available_equipment = available_equipment or []
    injury_areas = injury_areas or set()
    disliked = set(disliked_exercises or [])
    sport_emphasis = sport_emphasis or {"general"}
    usage_map = usage_map or {}

    prefer_loaded = equipment_mode in ("full_gym", "minimal")
    target_s = max(0, int(target_duration_min or 0)) * 60

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

    used_ids: Set[str] = set()
    warnings: List[str] = []

    def _choose(slot: Dict[str, Any], *, is_fill: bool = False) -> Optional[Dict[str, Any]]:
        pool = [
            ex for ex in candidates
            if ex["id"] not in used_ids and _pattern_matches(ex, slot)
        ]
        # 🌟 NOVÉ: doplnkový cvik v hlavnej časti musí byť skutočný silový
        # cvik (primary/secondary tier) - inak dopĺňanie dalo side plank
        # alebo bird-dog ako hlavný cvik 3x8-12 s pauzou 105 s.
        if is_fill:
            pool = [ex for ex in pool if ex.get("tier") in ("primary", "secondary")]
        # 🌟 NOVÉ: cvik musí sedieť na rozsah opakovaní, ktorý mu schéma dá.
        # Pri povinných slotoch radšej nevhodný cvik než prázdny slot,
        # preto fallback na nefiltrovaný pool (okrem fill slotov).
        rep_classes = _rep_classes_for_reps(
            get_scheme(goal=goal, tier=slot["tier"], level=level, is_deload=is_deload).get("reps")
        )
        rep_pool = [ex for ex in pool if _reps_ok(ex, rep_classes)]
        if rep_pool or is_fill:
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

    def _make_item(slot: Dict[str, Any], ex: Dict[str, Any]) -> Dict[str, Any]:
        sch = get_scheme(goal=goal, tier=slot["tier"], level=level, is_deload=is_deload)
        return {"slot": slot, "ex": ex, "sch": sch, "dur": estimate_exercise_duration_s(sch)}

    # --- 2) pre každý slot vyber najlepšieho kandidáta ---
    # 🌟 ZMENA: držíme jednu štruktúru items (slot + cvik + schéma + čas)
    # namiesto paralelných zoznamov s None. Rieši aj Pylance
    # reportOptionalSubscript na sch["sets"].
    items: List[Dict[str, Any]] = []
    for slot in list(template.get("slots") or []):
        ex = _choose(slot)
        if ex is None:
            if slot.get("required"):
                warnings.append(
                    f"no_exercise_for_required_slot:{slot['pattern']}/{slot['tier']}"
                )
            continue
        used_ids.add(ex["id"])
        items.append(_make_item(slot, ex))

    # --- 3) orež voliteľné sloty, ak je session nad cieľom ---
    kept_slots = trim_slots_to_duration(
        [it["slot"] for it in items],
        [it["dur"] for it in items],
        target_duration_min,
    )
    kept_ids = {id(s) for s in kept_slots}
    for it in items:
        if id(it["slot"]) not in kept_ids:
            used_ids.discard(it["ex"]["id"])
    items = [it for it in items if id(it["slot"]) in kept_ids]

    # --- 4) 🌟 NOVÉ: doplň session, ak je pod cieľom ---
    # Deload je zámerne kratší (objem ~60 %), ten nedopĺňame.
    if target_s > 0 and not is_deload:
        # 4a) ďalšie cvikmi na nepokryté vzory (variabilita pred objemom)
        patterns: List[str] = []
        for p in list(fill_patterns or []) + DEFAULT_FILL_PATTERNS:
            if p not in patterns:
                patterns.append(p)

        for pat in patterns:
            if _core_seconds(items) >= target_s * FILL_TOLERANCE:
                break
            main_items = [it for it in items if it["slot"]["block"] == BLOCK_MAIN]
            if len(main_items) >= MAX_MAIN_EXERCISES:
                break
            if any(it["ex"].get("pattern") == pat for it in main_items):
                continue
            fill_slot = _slot(pat, "secondary", BLOCK_MAIN, required=False)
            ex = _choose(fill_slot, is_fill=True)
            if ex is None:
                continue
            item = _make_item(fill_slot, ex)
            if _core_seconds(items) + item["dur"] > target_s * OVERSHOOT_LIMIT:
                continue
            used_ids.add(ex["id"])
            items.append(item)

        # 4b) série navyše na hlavných cvikoch (primary prvé)
        cap_delta = -1 if level == LEVEL_BEGINNER else 0
        while _core_seconds(items) < target_s * FILL_TOLERANCE:
            progressed = False
            main_sorted = sorted(
                (it for it in items if it["slot"]["block"] == BLOCK_MAIN),
                key=lambda it: _TIER_RANK.get(it["slot"]["tier"], 9),
            )
            for it in main_sorted:
                if _core_seconds(items) >= target_s * FILL_TOLERANCE:
                    break
                cap = SET_CAPS.get(it["slot"]["tier"], 3) + cap_delta
                if int(it["sch"]["sets"]) >= cap:
                    continue
                new_sch = {**it["sch"], "sets": int(it["sch"]["sets"]) + 1}
                new_dur = estimate_exercise_duration_s(new_sch)
                if _core_seconds(items) - it["dur"] + new_dur > target_s * OVERSHOOT_LIMIT:
                    continue
                it["sch"] = new_sch
                it["dur"] = new_dur
                progressed = True
            if not progressed:
                break

        if _core_seconds(items) < target_s * SHORT_SESSION_WARNING_RATIO:
            warnings.append("session_below_target_duration")

    # --- 5) výstup, zoradený podľa bloku (sort je stabilný) ---
    items.sort(key=lambda it: _BLOCK_RANK.get(it["slot"]["block"], 9))

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
    total_s = sum(it["dur"] for it in items)

    return {
        "template_key": template.get("key"),
        "template_name_en": template.get("name_en"),
        "sport_profile": template.get("sport_profile"),
        "exercises": exercises,
        "target_duration_min": int(target_duration_min or 0),
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
    sport_profile: Optional[Dict[str, Any]] = None,
    target_duration_min: int = 60,
    force_maintenance: bool = False,
    avoid_high_eccentric: bool = False,
    avoid_high_fatigue: bool = False,
) -> Dict[str, Any]:
    """
    Vysokoúrovňový vstupný bod: z nastavení athléta poskladá hotovú
    silovú session. Toto volá builder pred odoslaním do AI.

    sport_profile: 🌟 NOVÉ - celý profil z resolve_sport_profile(). Pridá
    extra sloty šablóne (napr. grip/carry pre OCR), dodá sport_emphasis
    (ak nie je zadaný explicitne) a priority_patterns na dopĺňanie.
    Maintenance šablóna sa profilom nerozširuje - má byť ľahká.
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
    )