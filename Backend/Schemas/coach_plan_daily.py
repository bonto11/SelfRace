from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class DailyWeekGenerateConfig(BaseModel):
    """
    Payload z FE pre daily generátor.

    - week_index: 1-based index týždňa v (budúcom) weekly pláne
    - plan_id: identifikátor weekly plánu (ak budeš mať tabuľku)
    - overwrite: prepísať existujúce daily pre daný týždeň
    - model, debug: voliteľné AI nastavenia
    """
    week_index: int
    plan_id: Optional[str] = None
    overwrite: bool = True
    model: Optional[str] = None
    debug: bool = True


# ---------------------------------------------------------------------------
# STRENGTH_EXERCISE_CATALOG
#
# Nové polia:
# - effectiveness: 1.0 – 3.0 (čím vyššie, tým "silnejší" / hodnotnejší cvik)
# ---------------------------------------------------------------------------

STRENGTH_EXERCISE_CATALOG = [
    # ---------- LOWER QUAD / GLUTES ----------
    {
        "id": "bodyweight_squat",
        "name": "Drep s vlastnou váhou",
        "equipment": ["none"],
        "muscle_groups": ["quads", "glutes"],
        "level": "easy",
        "effectiveness": 1.0,
    },
    {
        "id": "split_squat",
        "name": "Bulharský drep (split squat)",
        "equipment": ["box"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
        "effectiveness": 2.0,
    },
    {
        "id": "box_stepup",
        "name": "Výstupy na box",
        "equipment": ["box"],
        "muscle_groups": ["quads", "glutes"],
        "level": "easy",
        "effectiveness": 1.6,
    },
    {
        "id": "barbell_back_squat",
        "name": "Drep s veľkou činkou na chrbte",
        "equipment": ["barbell"],
        "muscle_groups": ["quads", "glutes"],
        "level": "hard",
        "effectiveness": 3.0,
    },
    {
        "id": "leg_press_machine",
        "name": "Leg press na stroji",
        "equipment": ["leg_press_machine"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
        "effectiveness": 2.4,
    },
    {
        "id": "dumbbell_lunge_walk",
        "name": "Chôdza výpadmi s jednoručkami",
        "equipment": ["dumbbells"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
        "effectiveness": 2.2,
    },

    # ---------- LOWER POSTERIOR / HAMSTRINGS ----------
    {
        "id": "glute_bridge_bodyweight",
        "name": "Glute bridge s vlastnou váhou",
        "equipment": ["none"],
        "muscle_groups": ["glutes", "hamstrings"],
        "level": "easy",
        "effectiveness": 1.2,
    },
    {
        "id": "single_leg_deadlift_band",
        "name": "Mŕtvy ťah na jednej nohe s gumou",
        "equipment": ["resistance_bands"],
        "muscle_groups": ["hamstrings", "glutes"],
        "level": "medium",
        "effectiveness": 1.8,
    },
    {
        "id": "romanian_deadlift_barbell",
        "name": "Rumunský mŕtvy ťah s veľkou činkou",
        "equipment": ["barbell"],
        "muscle_groups": ["hamstrings", "glutes"],
        "level": "hard",
        "effectiveness": 3.0,
    },
    {
        "id": "hip_thrust_barbell",
        "name": "Hip thrust s veľkou činkou",
        "equipment": ["barbell", "bench"],
        "muscle_groups": ["glutes", "hamstrings"],
        "level": "medium",
        "effectiveness": 2.6,
    },
    {
        "id": "hamstring_curl_machine",
        "name": "Zakopávanie na stroji",
        "equipment": ["hamstring_curl_machine"],
        "muscle_groups": ["hamstrings"],
        "level": "medium",
        "effectiveness": 2.0,
    },

    # ---------- CORE ----------
    {
        "id": "plank",
        "name": "Plank",
        "equipment": ["none"],
        "muscle_groups": ["core"],
        "level": "easy",
        "effectiveness": 1.0,
    },
    {
        "id": "side_plank",
        "name": "Bočný plank",
        "equipment": ["none"],
        "muscle_groups": ["core"],
        "level": "easy",
        "effectiveness": 1.0,
    },
    {
        "id": "abwheel_rollout",
        "name": "Ab wheel rollout z kolien",
        "equipment": ["abwheel"],
        "muscle_groups": ["core"],
        "level": "medium",
        "effectiveness": 2.0,
    },
    {
        "id": "cable_chop",
        "name": "Rotácie trupu na kladke (woodchop)",
        "equipment": ["cable_machine"],
        "muscle_groups": ["core"],
        "level": "medium",
        "effectiveness": 2.2,
    },
    {
        "id": "hanging_knee_raise",
        "name": "Zdvihy kolien vo vise",
        "equipment": ["pullup_bar"],
        "muscle_groups": ["core"],
        "level": "medium",
        "effectiveness": 2.2,
    },

    # ---------- UPPER PULL (BACK / BICEPS) ----------
    {
        "id": "bodyweight_row",
        "name": "Príťahy v predklone s vlastnou váhou (inverted row)",
        "equipment": ["none"],
        "muscle_groups": ["back", "biceps"],
        "level": "easy",
        "effectiveness": 1.2,
    },
    {
        "id": "trx_row",
        "name": "TRX príťahy",
        "equipment": ["trx"],
        "muscle_groups": ["back", "biceps"],
        "level": "easy",
        "effectiveness": 1.4,
    },
    {
        "id": "band_row",
        "name": "Príťahy s odporovou gumou",
        "equipment": ["resistance_bands"],
        "muscle_groups": ["back", "biceps"],
        "level": "easy",
        "effectiveness": 1.3,
    },
    {
        "id": "lat_pulldown_machine",
        "name": "Sťahovanie kladky na chrbát",
        "equipment": ["lat_pulldown_machine"],
        "muscle_groups": ["back", "biceps"],
        "level": "medium",
        "effectiveness": 2.4,
    },
    {
        "id": "seated_row_machine",
        "name": "Príťahy v sede na stroji",
        "equipment": ["row_machine"],
        "muscle_groups": ["back", "biceps"],
        "level": "medium",
        "effectiveness": 2.2,
    },
    {
        "id": "pullup_assisted",
        "name": "Príťahy na hrazde s dopomocou",
        "equipment": ["pullup_bar", "assisted_machine"],
        "muscle_groups": ["back", "biceps"],
        "level": "medium",
        "effectiveness": 2.5,
    },

    # ---------- UPPER PUSH (CHEST / SHOULDERS / TRICEPS) ----------
    {
        "id": "pushup",
        "name": "Kliky",
        "equipment": ["none"],
        "muscle_groups": ["chest", "triceps", "core"],
        "level": "easy",
        "effectiveness": 1.0,
    },
    {
        "id": "bench_press_barbell",
        "name": "Bench press s veľkou činkou",
        "equipment": ["barbell", "bench"],
        "muscle_groups": ["chest", "triceps"],
        "level": "medium",
        "effectiveness": 2.8,
    },
    {
        "id": "incline_db_press",
        "name": "Tlaky s jednoručkami na šikmej lavici",
        "equipment": ["dumbbells", "bench"],
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "level": "medium",
        "effectiveness": 2.4,
    },
    {
        "id": "shoulder_press_dumbbell",
        "name": "Tlaky nad hlavu s jednoručkami",
        "equipment": ["dumbbells"],
        "muscle_groups": ["shoulders", "triceps"],
        "level": "medium",
        "effectiveness": 2.2,
    },
    {
        "id": "chest_press_machine",
        "name": "Tlaky na prsia na stroji",
        "equipment": ["chest_press_machine"],
        "muscle_groups": ["chest", "triceps"],
        "level": "easy",
        "effectiveness": 2.0,
    },
    {
        "id": "dip_assisted",
        "name": "Dipy s dopomocou",
        "equipment": ["assisted_machine"],
        "muscle_groups": ["chest", "triceps"],
        "level": "medium",
        "effectiveness": 2.5,
    },
]