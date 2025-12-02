# Routes_DB/profile_metrics.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_PROFILE_METRIC_VALUE
from Services.profile_metrics import apply_user_filter_raw_metrics

supabase = get_client()

# -------- insert --------
def db_insert_metric_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    res = supabase.table(TABLE_PROFILE_METRIC_VALUE).insert(rows).execute()
    return res.data or rows

# -------- history jednej metriky --------
def db_get_metric_history(
    user_id: int,
    metric: str,
    user_uid: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    q = (
        supabase.table(TABLE_PROFILE_METRIC_VALUE)
        .select("metric,value_num,unit,measured_at,source,note")
        .eq("metric", metric)
        .order("measured_at", desc=False)
    )
    q = apply_user_filter_raw_metrics(q, user_id=user_id, user_uid=user_uid)
    if date_from:
        q = q.gte("measured_at", date_from)
    if date_to:
        q = q.lte("measured_at", date_to)
    if limit:
        q = q.limit(limit)

    res = q.execute()
    return res.data or []


# -------- latest pre jednu metriku --------
def db_get_latest_metric(
    user_id: int, metric: str, user_uid: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    q = (
        supabase.table(TABLE_PROFILE_METRIC_VALUE)
        .select("metric,value_num,unit,measured_at")
        .eq("metric", metric)
        .order("measured_at", desc=True)
        .limit(1)
    )
    q = apply_user_filter_raw_metrics(q, user_id=user_id, user_uid=user_uid)
    res = q.execute()
    data = res.data or []
    return data[0] if data else None

# -------- VO2 kompat endpoints --------
def db_get_vo2_measured_history(
    user_id: int, user_uid: Optional[str] = None
) -> List[Dict[str, Any]]:
    q = (
        supabase.table(TABLE_PROFILE_METRIC_VALUE)
        .select("value_num,measured_at")
        .eq("metric", "VO2Max_measured")
        .order("measured_at", desc=False)
    )
    q = apply_user_filter_raw_metrics(q, user_id=user_id, user_uid=user_uid)
    res = q.execute()
    return res.data or []