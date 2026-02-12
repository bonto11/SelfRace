# Schemas/user_recovery.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class RecoveryIn(BaseModel):
    # ✅ required identity
    user_id: int = Field(..., ge=1)
    date: str = Field(..., min_length=10, max_length=10)  # "YYYY-MM-DD"

    # ✅ main indicators
    RHR_bpm: Optional[int] = Field(default=None, ge=20, le=250)
    HRV_avg_ms: Optional[float] = Field(default=None, ge=0, le=1000)
    sleep_duration_min: Optional[int] = Field(default=None, ge=0, le=24 * 60)

    # ✅ add-ons
    HRV_max_ms: Optional[float] = Field(default=None, ge=0, le=2000)
    sleep_start_time: Optional[str] = Field(default=None, min_length=0, max_length=5)  # "HH:MM" (len basic)

    # ✅ factors that influence main indicators
    food_2h_before: Optional[bool] = None
    caffeine_8h: Optional[bool] = None
    alcohol_volume_ml: Optional[float] = Field(default=None, ge=0, le=5000)
    alcohol_type_pct: Optional[float] = Field(default=None, ge=0, le=100)
    comments: Optional[str] = Field(default=None, max_length=500)

    # ✅ reject unknown keys
    model_config = ConfigDict(extra="forbid")