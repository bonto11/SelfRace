from __future__ import annotations

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Literal

MetricKey = Literal[
    "weight_kg",
    "body_fat_pct",
    "HR_max",
    "VO2Max_measured",
    "VO2Max_estimated",
]


class MetricEntry(BaseModel):
    metric: MetricKey
    value_num: float
    unit: Optional[str] = None
    measured_at: Optional[datetime] = None
    source: Optional[str] = None
    note: Optional[str] = None


class BatchMetricsPayload(BaseModel):
    entries: List[MetricEntry] = Field(default_factory=list)
    # voliteľne – ak príde, uloží sa spolu s každým riadkom
