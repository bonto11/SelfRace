# Schemas/analytics.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class WeeklyWeekRow(BaseModel):
    week: str
    start: str
    end: str

    km_total: float
    km_run: float
    km_ride: float
    km_skate: float
    km_mixed: float

    time_min: float
    time_run_min: float
    time_ride_min: float
    time_strength_min: float
    time_skate_min: float
    time_mixed_min: float
    time_other_min: float

    trimp: float
    trimp_run: float
    trimp_ride: float
    trimp_strength: float
    trimp_skate: float
    trimp_mixed: float
    trimp_other: float

    monotony: Dict[str, float]
    strain: Dict[str, float]


class WeeklyAnalyticsResponse(BaseModel):
    success: bool
    weeks: List[WeeklyWeekRow]
    hr_used: Dict[str, Optional[Any]]
