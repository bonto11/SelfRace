# src/Services/profile.py
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any, Union
from datetime import datetime, date, timezone
from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_PROFILE_STATIC,
    TABLE_PROFILE_METRIC_VALUE,
)

# Povolené metriky (drž to sync s FE)
MetricKey = Literal[
    "weight_kg",
    "body_fat_pct",
    "HR_max",
    "VO2Max_measured",
    "VO2Max_estimated",
]

# ====== MODELY ======
class MetricEntry(BaseModel):
    metric: MetricKey
    value_num: float
    unit: Optional[str] = None
    measured_at: Optional[datetime] = None
    source: Optional[str] = None
    note: Optional[str] = None

class BatchMetricsPayload(BaseModel):
    entries: List[MetricEntry] = Field(default_factory=list)

class StaticPayload(BaseModel):
    sex: Optional[Literal["M", "F"]] = None
    # prijímame string YYYY-MM-DD, date alebo datetime
    birth_date: Optional[Union[str, date, datetime]] = None
    height_cm: Optional[float] = None

# ====== INIT ======
supabase = get_client()

# ====== POMOCNÉ ======
def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _birth_to_iso_date(val: Optional[Union[str, date, datetime]]) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, str):
        # očakávame "YYYY-MM-DD"
        return val
    if isinstance(val, date) and not isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, datetime):
        return val.date().isoformat()
    return None

def _fetch_static(user_id: int) -> Dict[str, Any]:
    res = supabase.table(TABLE_PROFILE_STATIC).select("*").eq("user_id", user_id).limit(1).execute()
    return res.data[0] if res.data else {}

def _fetch_latest_by_metric(user_id: int, metric: str) -> Optional[Dict[str, Any]]:
    res = (
        supabase.table(TABLE_PROFILE_METRIC_VALUE)
        .select("*")
        .eq("user_id", user_id)
        .eq("metric", metric)
        .order("measured_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None