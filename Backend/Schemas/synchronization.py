# backend/Schemas/synchronization.py
from __future__ import annotations
from typing import Dict, Optional
from pydantic import BaseModel

class SyncActivitiesRequest(BaseModel):
    force_last_days: Optional[int] = 30
    fetch_details: bool = True


class SyncActivitiesResponse(BaseModel):
    success: bool
    stats: Dict[str, int]
    note: Optional[str] = None