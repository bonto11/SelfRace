# Routes_DB/profile_metrics.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_PROFILE_METRIC

supabase = get_client()

def _apply_user_filter(q, user_id: int, user_uid: Optional[str]):
    """
    Minimal clone _apply_user_filter, ale iba pre DB layer.
    Ak máš už existujúcu funkciu v Services.profile, môžeš importnúť tú.
    """
    if user_uid:
        return q.eq("user_uid", user_uid)
    return q.eq("user_id", user_id)

# -------- insert --------
def db_insert_metric_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    res = supabase.table(TABLE_PROFILE_METRIC).insert(rows).execute()
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
        supabase.table(TABLE_PROFILE_METRIC)
        .select("metric,value_num,unit,measured_at,source,note")
        .eq("metric", metric)
        .order("measured_at", desc=False)
    )
    q = _apply_user_filter(q, user_id=user_id, user_uid=user_uid)
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
        supabase.table(TABLE_PROFILE_METRIC)
        .select("metric,value_num,unit,measured_at")
        .eq("metric", metric)
        .order("measured_at", desc=True)
        .limit(1)
    )
    q = _apply_user_filter(q, user_id=user_id, user_uid=user_uid)
    res = q.execute()
    data = res.data or []
    return data[0] if data else None

# -------- VO2 kompat endpoints --------
def db_get_vo2_measured_history(
    user_id: int, user_uid: Optional[str] = None
) -> List[Dict[str, Any]]:
    q = (
        supabase.table(TABLE_PROFILE_METRIC)
        .select("value_num,measured_at")
        .eq("metric", "VO2Max_measured")
        .order("measured_at", desc=False)
    )
    q = _apply_user_filter(q, user_id=user_id, user_uid=user_uid)
    res = q.execute()
    return res.data or []

def fetch_user_hr_max(user_id: int) -> Optional[float]:
    try:
        rec = (supabase.table(TABLE_PROFILE_METRIC)
               .select("value_num")
               .eq("user_id", user_id)
               .eq("metric", "HR_max")
               .order("measured_at", desc=True)
               .limit(1)
               .execute())
        row = (rec.data or [None])[0]
        v = float(row.get("value_num") or 0) if row else 0
        return v if v > 0 else None
    except Exception:
        return None