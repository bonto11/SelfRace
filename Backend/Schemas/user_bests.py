# Schemas/user_bests.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class UserBestPayload(BaseModel):
    sport: str = "run"
    distance_m: int
    # môžeš poslať buď time_sec alebo time_str (HH:MM:SS)
    time_sec: Optional[int] = None
    time_str: Optional[str] = None

    activity_id: Optional[int] = None
    activity_name: Optional[str] = None
    achieved_at: Optional[str] = None  # ISO dátum/datetime


class UserBestRow(BaseModel):
    sport: str
    distance_m: int
    best_time_s: int
    time_str: str

    activity_id: Optional[int] = None
    activity_name: Optional[str] = None
    achieved_at: Optional[str] = None
    updated_at: Optional[str] = None