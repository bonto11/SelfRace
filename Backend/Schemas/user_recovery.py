# Schemas/user_recovery.py
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional

class RecoveryIn(BaseModel):
    user_id: int
    date: Optional[str] = None  # YYYY-MM-DD
    RHR_bpm: Optional[int] = None
    HRV_avg_ms: Optional[int] = None
    HRV_max_ms: Optional[int] = None
    sleep_duration_min: Optional[int] = None
    sleep_start_time: Optional[str] = None
    alcohol_volume_ml: Optional[int] = None
    alcohol_type_pct: Optional[int] = None
    food_2h_before: Optional[bool] = None
    caffeine_8h: Optional[bool] = None
    comments: Optional[str] = None