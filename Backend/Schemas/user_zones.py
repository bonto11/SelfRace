# Schemas/user_zones.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel
from typing import Optional, TypedDict, Literal

Sport = Literal["running", "cycling", "other"]

class ZonesPayload(BaseModel):
    # voliteľný športový kontext
    sport: Optional[str] = None

    # HRmax aliasy
    hr_max: Optional[int] = None
    hr_max_bpm: Optional[int] = None

    # zóny (FE shape)
    z1_min: Optional[int] = None
    z1_max: Optional[int] = None
    z2_min: Optional[int] = None
    z2_max: Optional[int] = None
    z3_min: Optional[int] = None
    z3_max: Optional[int] = None
    z4_min: Optional[int] = None
    z4_max: Optional[int] = None
    z5_min: Optional[int] = None
    z5_max: Optional[int] = None  # v DB sa horná hranica Z5 odvádza z HRmax, nechávame kvôli FE

class ZonesOut(TypedDict, total=False):
    sport: Sport
    hr_max: Optional[int]
    z1_min: Optional[int]
    z1_max: Optional[int]
    z2_min: Optional[int]
    z2_max: Optional[int]
    z3_min: Optional[int]
    z3_max: Optional[int]
    z4_min: Optional[int]
    z4_max: Optional[int]
    z5_min: Optional[int]
    z5_max: Optional[int]
    created_at: Optional[str]