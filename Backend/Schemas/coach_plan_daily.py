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


STRENGTH_EXERCISE_CATALOG = [
    # ---------- LOWER QUAD / GLUTES ----------
    {
        "id": "bodyweight_squat",
        "name": "Drep s vlastnou váhou",
        "equipment": ["none"],
        "muscle_groups": ["quads", "glutes"],
        "level": "easy",
    },
    {
        "id": "split_squat",
        "name": "Bulharský drep (split squat)",
        "equipment": ["box"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
    },
    {
        "id": "box_stepup",
        "name": "Výstupy na box",
        "equipment": ["box"],
        "muscle_groups": ["quads", "glutes"],
        "level": "easy",
    },
    {
        "id": "barbell_back_squat",
        "name": "Drep s veľkou činkou na chrbte",
        "equipment": ["barbell"],
        "muscle_groups": ["quads", "glutes"],
        "level": "hard",
    },
    {
        "id": "leg_press_machine",
        "name": "Leg press na stroji",
        "equipment": ["leg_press_machine"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
    },
    {
        "id": "dumbbell_lunge_walk",
        "name": "Chôdza výpadmi s jednoručkami",
        "equipment": ["dumbbells"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
    },

    # ---------- LOWER POSTERIOR / HAMSTRINGS ----------
    {
        "id": "glute_bridge_bodyweight",
        "name": "Glute bridge s vlastnou váhou",
        "equipment": ["none"],
        "muscle_groups": ["glutes", "hamstrings"],
        "level": "easy",
    },
    {
        "id": "single_leg_deadlift_band",
        "name": "Mŕtvy ťah na jednej nohe s gumou",
        "equipment": ["resistance_bands"],
        "muscle_groups": ["hamstrings", "glutes"],
        "level": "medium",
    },
    {
        "id": "romanian_deadlift_barbell",
        "name": "Rumunský mŕtvy ťah s veľkou činkou",
        "equipment": ["barbell"],
        "muscle_groups": ["hamstrings", "glutes"],
        "level": "hard",
    },
    {
        "id": "hip_thrust_barbell",
        "name": "Hip thrust s veľkou činkou",
        "equipment": ["barbell", "bench"],
        "muscle_groups": ["glutes", "hamstrings"],
        "level": "medium",
    },
    {
        "id": "hamstring_curl_machine",
        "name": "Zakopávanie na stroji",
        "equipment": ["hamstring_curl_machine"],
        "muscle_groups": ["hamstrings"],
        "level": "medium",
    },

    # ---------- CORE ----------
    {
        "id": "plank",
        "name": "Plank",
        "equipment": ["none"],
        "muscle_groups": ["core"],
        "level": "easy",
    },
    {
        "id": "side_plank",
        "name": "Bočný plank",
        "equipment": ["none"],
        "muscle_groups": ["core"],
        "level": "easy",
    },
    {
        "id": "abwheel_rollout",
        "name": "Ab wheel rollout z kolien",
        "equipment": ["abwheel"],
        "muscle_groups": ["core"],
        "level": "medium",
    },
    {
        "id": "cable_chop",
        "name": "Rotácie trupu na kladke (woodchop)",
        "equipment": ["cable_machine"],
        "muscle_groups": ["core"],
        "level": "medium",
    },
    {
        "id": "hanging_knee_raise",
        "name": "Zdvihy kolien vo vise",
        "equipment": ["pullup_bar"],
        "muscle_groups": ["core"],
        "level": "medium",
    },

    # ---------- UPPER PULL (BACK / BICEPS) ----------
    {
        "id": "bodyweight_row",
        "name": "Príťahy v predklone s vlastnou váhou (inverted row)",
        "equipment": ["none"],
        "muscle_groups": ["back", "biceps"],
        "level": "easy",
    },
    {
        "id": "trx_row",
        "name": "TRX príťahy",
        "equipment": ["trx"],
        "muscle_groups": ["back", "biceps"],
        "level": "easy",
    },
    {
        "id": "band_row",
        "name": "Príťahy s odporovou gumou",
        "equipment": ["resistance_bands"],
        "muscle_groups": ["back", "biceps"],
        "level": "easy",
    },
    {
        "id": "lat_pulldown_machine",
        "name": "Sťahovanie kladky na chrbát",
        "equipment": ["lat_pulldown_machine"],
        "muscle_groups": ["back", "biceps"],
        "level": "medium",
    },
    {
        "id": "seated_row_machine",
        "name": "Príťahy v sede na stroji",
        "equipment": ["row_machine"],
        "muscle_groups": ["back", "biceps"],
        "level": "medium",
    },
    {
        "id": "pullup_assisted",
        "name": "Príťahy na hrazde s dopomocou",
        "equipment": ["pullup_bar", "assisted_machine"],
        "muscle_groups": ["back", "biceps"],
        "level": "medium",
    },

    # ---------- UPPER PUSH (CHEST / SHOULDERS / TRICEPS) ----------
    {
        "id": "pushup",
        "name": "Kliky",
        "equipment": ["none"],
        "muscle_groups": ["chest", "triceps", "core"],
        "level": "easy",
    },
    {
        "id": "bench_press_barbell",
        "name": "Bench press s veľkou činkou",
        "equipment": ["barbell", "bench"],
        "muscle_groups": ["chest", "triceps"],
        "level": "medium",
    },
    {
        "id": "incline_db_press",
        "name": "Tlaky s jednoručkami na šikmej lavici",
        "equipment": ["dumbbells", "bench"],
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "level": "medium",
    },
    {
        "id": "shoulder_press_dumbbell",
        "name": "Tlaky nad hlavu s jednoručkami",
        "equipment": ["dumbbells"],
        "muscle_groups": ["shoulders", "triceps"],
        "level": "medium",
    },
    {
        "id": "chest_press_machine",
        "name": "Tlaky na prsia na stroji",
        "equipment": ["chest_press_machine"],
        "muscle_groups": ["chest", "triceps"],
        "level": "easy",
    },
    {
        "id": "dip_assisted",
        "name": "Dipy s dopomocou",
        "equipment": ["assisted_machine"],
        "muscle_groups": ["chest", "triceps"],
        "level": "medium",
    },
]