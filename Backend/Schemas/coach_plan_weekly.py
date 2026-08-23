# Schemas/coach_plan_weekly.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class WeeklyGenerateConfig(BaseModel):
    """
    Payload z FE pre weekly generátor.

    - overwrite: prepísať existujúci weekly plán
    - full_reset: kompletné vymazanie vrátane histórie (len pre prvotné
      generovanie z Prefs, pred aktiváciou plánu)
    - state_id: konkrétny coach_athlete_state.id (ak None → použije najnovší)
    - weeks: koľko týždňov plánu (ak None → z prefs alebo 6)
    - target_end_date: 🌟 YYYY-MM-DD z date pickera v Coach Notes ("Veľká
      zmena") - athlete si vyberie nový koncový dátum plánu (predvyplnený
      aktuálnym koncom), BE z toho deterministicky dopočíta počet týždňov.
      Skracuje alebo predlžuje plán presne k tomuto dátumu. Má prioritu
      pred `weeks`. Používa sa len pri replane (nie pri full_reset).
    - model: voliteľný názov LLM modelu
    - debug: či vrátiť aj debug trace z AI
    """
    overwrite: bool = True
    full_reset: bool = False
    state_id: Optional[int] = None
    weeks: Optional[int] = None
    target_end_date: Optional[str] = None
    model: Optional[str] = None
    debug: bool = False
