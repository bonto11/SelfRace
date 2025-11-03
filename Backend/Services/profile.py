# src/routes/profile.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone
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
    birth_date: Optional[datetime] = None  # prijímame ISO dátum/string; FE zvykne posielať "YYYY-MM-DD"
    height_cm: Optional[float] = None

# ====== INIT ======
supabase = get_client()


# ====== POMOCNÉ ======
def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _to_iso_date_str(d: Optional[datetime]) -> Optional[str]:
    if not d:
        return None
    # ak príde iba date bez tz, necháme to ako ISO8601
    try:
        return d.isoformat()
    except Exception:
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