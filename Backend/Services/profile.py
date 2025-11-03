from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any, Union
from datetime import datetime, date, timezone
from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_PROFILE_STATIC,
    TABLE_PROFILE_METRIC_VALUE,
)

# Povolené metriky (drž v sync s FE)
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
    # voliteľne – ak príde, uloží sa spolu s každým riadkom
    user_uid: Optional[str] = None

class StaticPayload(BaseModel):
    sex: Optional[Literal["M", "F"]] = None
    birth_date: Optional[Union[str, date, datetime]] = None
    height_cm: Optional[float] = None
    # voliteľne – keď pošleš, upsert pôjde cez user_uid
    user_uid: Optional[str] = None

# ====== INIT ======
supabase = get_client()

# ====== POMOCNÉ ======
def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _birth_to_iso_date(val: Optional[Union[str, date, datetime]]) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, str):
        return val  # očakávame "YYYY-MM-DD"
    if isinstance(val, date) and not isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, datetime):
        return val.date().isoformat()
    return None

def _apply_user_filter(q, user_id: Optional[int] = None, user_uid: Optional[str] = None):
    """
    Preferuj user_uid, fallback na user_id.
    """
    if user_uid:
        return q.eq("user_uid", user_uid)
    return q.eq("user_id", user_id)

def _fetch_static(user_id: Optional[int] = None, user_uid: Optional[str] = None) -> Dict[str, Any]:
    q = supabase.table(TABLE_PROFILE_STATIC).select("*").limit(1)
    q = _apply_user_filter(q, user_id, user_uid)
    res = q.execute()
    return res.data[0] if res.data else {}

def _fetch_latest_by_metric(
    user_id: Optional[int],
    metric: str,
    user_uid: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    q = (
        supabase.table(TABLE_PROFILE_METRIC_VALUE)
        .select("*")
        .eq("metric", metric)
        .order("measured_at", desc=True)
        .limit(1)
    )
    q = _apply_user_filter(q, user_id, user_uid)
    res = q.execute()
    return res.data[0] if res.data else None