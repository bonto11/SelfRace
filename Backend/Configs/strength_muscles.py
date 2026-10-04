# Configs/strength_muscles.py
"""
Mapovanie cvikov na svalové partie + týždenné objemové ciele.

PREČO SAMOSTATNÝ SÚBOR:
strength_catalog.py rieši, ako sa cvik VYBERÁ (pattern, tier, fatigue_cost).
Tento súbor rieši, čo cvik ZAŤAŽUJE - a to je jediná vec, ktorá dáva zmysel
ukazovať userovi ("tento týždeň si mal 12 sérií na chrbát").

ZLOMKOVÝ OBJEM (fractional volume):
- 1.0 = partia je hlavný hýbateľ (bench -> prsia)
- 0.5 = partia významne pomáha (bench -> triceps, ramená)
Bez zlomkov by vyšlo, že triceps nerobíš, hoci ho rozbíjaš každým tlakom.
Toto je štandardný prístup v odbornej literatúre o objeme.

TÝŽDENNÉ CIELE (počet PRACOVNÝCH sérií na partiu za 7 dní, warmup sa neráta):
- 4-8   udržiavanie - pre vytrvalca, ktorý silu len drží a chráni sa pred zranením
- 10-20 rozvoj - pásmo, kde reálne rastie sila a svalová hmota
- 20+   klesajúci prínos a rastúca únava, pre bežca kontraproduktívne
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

MuscleKey = Literal[
    "chest", "back", "shoulders", "biceps", "triceps", "forearms",
    "core", "glutes", "quads", "hamstrings", "calves",
]

# Poradie pre UI (zhora nadol: veľké partie, potom malé)
MUSCLE_GROUPS: List[str] = [
    "chest", "back", "shoulders", "biceps", "triceps", "forearms",
    "core", "glutes", "quads", "hamstrings", "calves",
]

# Týždenné pásma objemu (pracovné série na partiu)
VOLUME_BANDS = {
    "maintenance_min": 4,
    "maintenance_max": 8,
    "development_min": 10,
    "development_max": 20,
    "overreach": 22,
}


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


# ============================================================
# CVIK -> PARTIE
# ============================================================

EXERCISE_MUSCLES: Dict[str, Dict[str, float]] = {
    # ================= CORE =================
    "plank": {"core": 1.0},
    "side_plank": {"core": 1.0},
    "abwheel_rollout": {"core": 1.0, "shoulders": 0.5},
    "hanging_knee_raise": {"core": 1.0, "forearms": 0.5},
    "cable_chop": {"core": 1.0, "shoulders": 0.5},
    "bird_dog": {"core": 1.0, "glutes": 0.5},
    "dead_bug": {"core": 1.0},
    "russian_twist": {"core": 1.0},
    "mountain_climber": {"core": 1.0, "shoulders": 0.5},
    "hollow_body_hold": {"core": 1.0},
    "medicine_ball_rotational_throw": {"core": 1.0, "shoulders": 0.5},

    # ================= LOWER BODY (QUADS) =================
    "bodyweight_squat": {"quads": 1.0, "glutes": 0.5},
    "barbell_back_squat": {"quads": 1.0, "glutes": 1.0, "core": 0.5},
    "front_squat_barbell": {"quads": 1.0, "glutes": 0.5, "core": 0.5},
    "leg_press_machine": {"quads": 1.0, "glutes": 0.5},
    "split_squat": {"quads": 1.0, "glutes": 1.0},
    "goblet_squat": {"quads": 1.0, "glutes": 0.5, "core": 0.5},
    "box_stepup": {"quads": 1.0, "glutes": 1.0},
    "bulgarian_split_squat": {"quads": 1.0, "glutes": 1.0},
    "walking_lunge": {"quads": 1.0, "glutes": 1.0},
    "hack_squat_machine": {"quads": 1.0, "glutes": 0.5},
    "leg_extension_machine": {"quads": 1.0},

    # ================= LOWER BODY (POSTERIOR) =================
    "glute_bridge_bodyweight": {"glutes": 1.0, "hamstrings": 0.5},
    "romanian_deadlift_barbell": {"hamstrings": 1.0, "glutes": 1.0, "back": 0.5},
    "romanian_deadlift_dumbbell": {"hamstrings": 1.0, "glutes": 1.0, "back": 0.5},
    "single_leg_deadlift_band": {"hamstrings": 1.0, "glutes": 1.0, "core": 0.5},
    "hamstring_curl_machine": {"hamstrings": 1.0},
    "hip_thrust_barbell": {"glutes": 1.0, "hamstrings": 0.5},
    "kettlebell_swing": {"glutes": 1.0, "hamstrings": 1.0, "back": 0.5},
    "conventional_deadlift": {"hamstrings": 1.0, "glutes": 1.0, "back": 1.0, "forearms": 0.5},
    "good_morning_barbell": {"hamstrings": 1.0, "glutes": 0.5, "back": 0.5},
    "back_extension": {"back": 1.0, "glutes": 0.5, "hamstrings": 0.5},

    # ================= CALVES & ANKLES =================
    "standing_calf_raise": {"calves": 1.0},
    "seated_calf_raise": {"calves": 1.0},
    "single_leg_calf_raise": {"calves": 1.0},
    "jump_rope": {"calves": 1.0},
    "tibialis_raise": {"calves": 0.5},

    # ================= UPPER PULL =================
    "bodyweight_row": {"back": 1.0, "biceps": 0.5},
    "trx_row": {"back": 1.0, "biceps": 0.5},
    "lat_pulldown_machine": {"back": 1.0, "biceps": 0.5},
    "pullup_assisted": {"back": 1.0, "biceps": 0.5},
    "pullup_strict": {"back": 1.0, "biceps": 0.5, "forearms": 0.5},
    "dumbbell_row": {"back": 1.0, "biceps": 0.5},
    "barbell_row": {"back": 1.0, "biceps": 0.5},
    "seated_cable_row": {"back": 1.0, "biceps": 0.5},
    "face_pull": {"shoulders": 1.0, "back": 0.5},
    "chin_up": {"back": 1.0, "biceps": 1.0},
    "band_pull_apart": {"shoulders": 1.0, "back": 0.5},
    "cable_external_rotation": {"shoulders": 1.0},

    # ================= UPPER PUSH =================
    "pushup": {"chest": 1.0, "triceps": 0.5, "shoulders": 0.5},
    "bench_press_barbell": {"chest": 1.0, "triceps": 0.5, "shoulders": 0.5},
    "incline_db_press": {"chest": 1.0, "shoulders": 0.5, "triceps": 0.5},
    "shoulder_press_dumbbell": {"shoulders": 1.0, "triceps": 0.5},
    "dip_assisted": {"chest": 1.0, "triceps": 1.0, "shoulders": 0.5},
    "dip_strict": {"chest": 1.0, "triceps": 1.0, "shoulders": 0.5},
    "overhead_press_barbell": {"shoulders": 1.0, "triceps": 0.5, "core": 0.5},
    "push_press": {"shoulders": 1.0, "triceps": 0.5, "quads": 0.5},
    "pec_deck_fly": {"chest": 1.0},
    "triceps_pushdown": {"triceps": 1.0},
    "scapular_pushup": {"shoulders": 1.0},

    # ================= FUNCTIONAL / HYROX / OCR =================
    "farmers_carry": {"forearms": 1.0, "core": 1.0, "back": 0.5},
    "sandbag_carry": {"core": 1.0, "back": 1.0, "forearms": 0.5},
    "bucket_carry": {"forearms": 1.0, "core": 1.0, "back": 0.5},
    "sled_push": {"quads": 1.0, "glutes": 1.0, "calves": 0.5},
    "sled_pull": {"back": 1.0, "quads": 0.5, "biceps": 0.5},
    "ski_erg": {"back": 1.0, "core": 1.0, "triceps": 0.5},
    "rowing_erg": {"back": 1.0, "quads": 0.5, "biceps": 0.5},
    "assault_bike": {"quads": 0.5, "shoulders": 0.5},
    "wall_ball": {"quads": 1.0, "shoulders": 1.0, "glutes": 0.5},
    "thruster": {"quads": 1.0, "shoulders": 1.0, "glutes": 0.5, "triceps": 0.5},
    "sandbag_lunge": {"quads": 1.0, "glutes": 1.0, "core": 0.5},
    "box_jump": {"quads": 1.0, "glutes": 0.5, "calves": 0.5},
    "broad_jump": {"quads": 1.0, "glutes": 1.0, "calves": 0.5},
    "burpee": {"chest": 0.5, "quads": 0.5, "core": 0.5},
    "devils_press": {"shoulders": 1.0, "hamstrings": 0.5, "quads": 0.5, "core": 0.5},
    "turkish_getup": {"shoulders": 1.0, "core": 1.0},
    "kettlebell_clean_and_press": {"shoulders": 1.0, "glutes": 0.5, "hamstrings": 0.5, "core": 0.5},
    "medicine_ball_slam": {"core": 1.0, "back": 0.5, "shoulders": 0.5},
    "rope_climb": {"back": 1.0, "biceps": 1.0, "forearms": 1.0},
    "dead_hang": {"forearms": 1.0},
    "monkey_bar_traverse": {"forearms": 1.0, "back": 0.5, "biceps": 0.5},
    # ================= DOPLNENÉ ZÁKLADNÉ CVIKY =================
    "dumbbell_biceps_curl": {"biceps": 1.0, "forearms": 0.5},
    "barbell_biceps_curl": {"biceps": 1.0, "forearms": 0.5},
    "hammer_curl": {"biceps": 1.0, "forearms": 0.5},
    "cable_biceps_curl": {"biceps": 1.0, "forearms": 0.5},
    "overhead_triceps_extension": {"triceps": 1.0},
    "skull_crusher": {"triceps": 1.0},
    "close_grip_bench_press": {"triceps": 1.0, "chest": 0.5, "shoulders": 0.5},
    "bench_dip": {"triceps": 1.0, "chest": 0.5},
    "lateral_raise": {"shoulders": 1.0},
    "rear_delt_fly": {"shoulders": 1.0, "back": 0.5},
    "dumbbell_bench_press": {"chest": 1.0, "triceps": 0.5, "shoulders": 0.5},
    "chest_press_machine": {"chest": 1.0, "triceps": 0.5, "shoulders": 0.5},
    "cable_fly": {"chest": 1.0, "shoulders": 0.5},
    "trap_bar_deadlift": {"glutes": 1.0, "quads": 0.5, "hamstrings": 0.5, "back": 0.5, "forearms": 0.5},
    "machine_row": {"back": 1.0, "biceps": 0.5},
    "reverse_lunge": {"quads": 1.0, "glutes": 1.0},
    "lateral_lunge": {"quads": 1.0, "glutes": 0.5},
    "single_leg_glute_bridge": {"glutes": 1.0, "hamstrings": 0.5},
    "nordic_hamstring_curl": {"hamstrings": 1.0},
    "hip_abduction_machine": {"glutes": 1.0},
    "lateral_band_walk": {"glutes": 1.0},
    "pallof_press": {"core": 1.0},
    "lying_leg_raise": {"core": 1.0},
    "copenhagen_plank": {"core": 1.0, "glutes": 0.5},
    "crunch": {"core": 1.0},
}


def get_muscles(exercise_id: str) -> Dict[str, float]:
    """Partie cviku so zlomkovou váhou. Neznámy cvik -> prázdny dict."""
    return EXERCISE_MUSCLES.get(str(exercise_id or ""), {})


def primary_muscles(exercise_id: str) -> List[str]:
    """Len hlavné partie (váha 1.0) - na filtrovanie v UI."""
    return [m for m, w in get_muscles(exercise_id).items() if w >= 1.0]


def exercises_for_muscle(muscle: str, primary_only: bool = False) -> List[str]:
    """Všetky cviky, ktoré danú partiu zaťažujú."""
    out: List[str] = []
    for ex_id, muscles in EXERCISE_MUSCLES.items():
        w = muscles.get(muscle)
        if w is None:
            continue
        if primary_only and w < 1.0:
            continue
        out.append(ex_id)
    return sorted(out)


def missing_muscle_ids() -> List[str]:
    """
    Diagnostika: cviky z katalógu, ktoré tu ešte nemajú partie.
    Pri pridaní nového cviku do strength_catalog.py to rovno odhalí.
    """
    from Configs.strength_catalog import STRENGTH_EXERCISE_CATALOG

    return sorted(
        ex["id"] for ex in STRENGTH_EXERCISE_CATALOG if ex["id"] not in EXERCISE_MUSCLES
    )