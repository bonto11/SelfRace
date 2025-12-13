# backend/Schemas/coach_types.py
# Schemas/coach_types.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


# ───────────────────────── Analyze / Athlete state ─────────────────────────


class CoachAnalyzeInput(TypedDict):
    """Vstup pre AI analýzu atlétovho stavu."""
    schema_version: int
    user: Dict[str, Any]
    prefs: Dict[str, Any]
    zones: Dict[str, Any]
    thresholds: Dict[str, Any]
    bests: Dict[str, Any]
    recent_load: Dict[str, Any]
    recovery: Dict[str, Any]
    active_plan: Dict[str, Any]


class CoachAthleteState(TypedDict):
    """Výstup z AI analýzy formy."""
    schema_version: int
    generated_at: str
    model: str
    user_summary: Dict[str, Any]
    ai_state: Dict[str, Any]


# ───────────────────────── Weekly plan ─────────────────────────


class WeeklyWeek(TypedDict, total=False):
    week_index: int
    week_start: str
    week_end: str
    goal: Optional[str]
    focus: Optional[str]
    load_phase: Optional[str]
    planned_km: Optional[float]
    planned_minutes: Optional[int]
    intensity_mix: Dict[str, Any]
    sessions_summary: Dict[str, Any]
    key_sessions: List[Dict[str, Any]]
    notes: Optional[str]


class CoachWeeklyPlanInput(TypedDict):
    """Čo posielame AI pre weekly plán (high-level týždne)."""
    schema_version: int
    prefs: Dict[str, Any]
    athlete_state: Dict[str, Any]
    active_plan: Dict[str, Any]


class CoachWeeklyPlan(TypedDict):
    """AI výstup – plán po týždňoch."""
    schema_version: int
    generated_at: str
    model: str
    meta: Dict[str, Any]
    weeks: List[WeeklyWeek]


# ───────────────────────── Daily week plan ─────────────────────────


class DailySession(TypedDict, total=False):
    sport: str
    title: str
    session_type: str
    duration_min: int
    intensity: Optional[str]
    hr_zone_label: Optional[str]
    target_hr_bpm_range: Optional[List[int]]
    structure: Any
    notes: Optional[str]
    tags: List[str]


class DailyDay(TypedDict, total=False):
    """Jeden deň v týždni – to, čo berieme/vkladáme do DB."""
    day: str
    notes: Optional[str]
    sessions: List[DailySession]


class CoachDailyWeekInput(TypedDict):
    """Vstup pre AI na rozbitie 1 týždňa weekly plánu na denné tréningy."""
    schema_version: int
    week: WeeklyWeek          # week_context z weekly plánu
    prefs: Dict[str, Any]
    athlete_state: Dict[str, Any]
    existing_days: List[DailyDay]
    meta: Dict[str, Any]      # user_id, plan_id, atď.


class CoachDailyWeekPlan(TypedDict):
    """AI výstup – detailný plán na 1 týždeň (7 dní)."""
    schema_version: int
    generated_at: str
    model: str
    week_index: int
    week_start: str
    week_end: str
    week_summary: Optional[str]
    days: List[DailyDay]