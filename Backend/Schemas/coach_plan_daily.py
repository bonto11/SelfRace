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
    debug: bool = False