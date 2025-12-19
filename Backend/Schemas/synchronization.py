from __future__ import annotations

from typing import Dict, Optional
from pydantic import BaseModel, Field


class SyncActivitiesRequest(BaseModel):
    """
    Payload z FE pre manuálne spustenie syncu.
    """
    force_last_days: Optional[int] = Field(
        default=30,
        description="Ak ešte nemáme žiadne aktivity, stiahneme posledných N dní.",
    )
    fetch_details: bool = Field(
        default=True,
        description="Či dotiahnuť aj laps/splits a enrichment.",
    )


class SyncActivitiesResponse(BaseModel):
    """
    Response pre FE – jednoduché štatistiky.
    """
    success: bool
    stats: Dict[str, int]
    note: Optional[str] = None