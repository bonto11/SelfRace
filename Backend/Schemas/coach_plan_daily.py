# Schemas/coach_plan_daily.py
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
    {
        "id": "split_squat",
        "name": "Bulharský drep (split squat)",
        "equipment": ["box"],
        "muscle_groups": ["quads", "glutes"],
        "level": "medium",
    },
    {
        "id": "bodyweight_squat",
        "name": "Drep s vlastnou váhou",
        "equipment": ["none"],
        "muscle_groups": ["quads", "glutes"],
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
        "id": "pushup",
        "name": "Kliky",
        "equipment": ["none"],
        "muscle_groups": ["chest", "triceps", "core"],
        "level": "easy",
    },
    {
        "id": "box_stepup",
        "name": "Výstupy na box",
        "equipment": ["box"],
        "muscle_groups": ["quads", "glutes"],
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
]