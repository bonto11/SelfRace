# Schemas/coach_plan_weekly.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class WeeklyGenerateConfig(BaseModel):
    """
    Payload z FE pre weekly generátor.

    - overwrite: prepísať existujúci weekly plán
    - state_id: konkrétny coach_athlete_state.id (ak None → použije najnovší)
    - weeks: koľko týždňov plánu (ak None → z prefs alebo 6)
    - model: voliteľný názov LLM modelu
    - debug: či vrátiť aj debug trace z AI
    """
    overwrite: bool = True
    full_reset: bool = False
    state_id: Optional[int] = None
    weeks: Optional[int] = None
    model: Optional[str] = None
    debug: bool = False