# Schemas/coach_athlete_state.py
from __future__ import annotations
from typing import  Optional
from pydantic import BaseModel

class AnalyzeConfig(BaseModel):
  """
  Konfig pre analyze:
    - debug: zapne logovanie input/state na BE
    - save_to_db: či sa má výsledný state uložiť do DB
    - model: názov modelu (default coach-analyze-stub)
  """
  debug: bool = False
  save_to_db: bool = True
  model: Optional[str] = "coach-analyze-stub"
