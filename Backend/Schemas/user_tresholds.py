# Schemas/user_thresholds.py
from typing import Optional
from pydantic import BaseModel

class ThresholdPayload(BaseModel):
    sport: Optional[str] = None
    threshold_type: Optional[str] = None
    hr_bpm: Optional[float] = None
    pace_sec_km: Optional[float] = None
    power_watt: Optional[float] = None
    measurement_type: Optional[str] = None
