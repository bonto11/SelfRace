from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_PROFILE_METRIC

# -------- insert --------
def db_insert_metric_rows(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="profile_metrics.db_insert_metric_rows")

    res = sb.table(TABLE_PROFILE_METRIC).insert(rows).execute()
    return res.data or rows


# -------- history jednej metriky --------
def db_get_metric_history(
    user_id: int,
    metric: str,
    user_uid: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: Optional[int] = None,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="profile_metrics.db_get_metric_history")

    q = (
        sb.table(TABLE_PROFILE_METRIC)
        .select("metric,value_num,unit,measured_at,source,note")
        .eq("metric", metric)
        .order("measured_at", desc=False)
    )
    q.eq("user_id", user_id)
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
    user_id: int,
    metric: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="profile_metrics.db_get_latest_metric")

    q = (
        sb.table(TABLE_PROFILE_METRIC)
        .select("metric,value_num,unit,measured_at")
        .eq("metric", metric)
        .order("measured_at", desc=True)
        .limit(1)
    )
    q.eq("user_id", user_id)
    res = q.execute()
    data = res.data or []
    return data[0] if data else None


# -------- VO2 kompat endpoints --------
def db_get_vo2_measured_history(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="profile_metrics.db_get_vo2_measured_history")

    q = (
        sb.table(TABLE_PROFILE_METRIC)
        .select("value_num,measured_at")
        .eq("metric", "VO2Max_measured")
        .order("measured_at", desc=False)
    )
    q.eq("user_id", user_id)
    res = q.execute()
    return res.data or []


def fetch_user_hr_max(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[float]:
    """
    Helper na vytiahnutie HR_max z profile_metric.
    """
    sb = get_sb(ctx, caller="profile_metrics.fetch_user_hr_max")

    try:
        rec = (
            sb.table(TABLE_PROFILE_METRIC)
            .select("value_num")
            .eq("user_id", user_id)
            .eq("metric", "HR_max")
            .order("measured_at", desc=True)
            .limit(1)
            .execute()
        )
        row = (rec.data or [None])[0]
        v = float(row.get("value_num") or 0) if row else 0
        return v if v > 0 else None
    except Exception:
        return None
