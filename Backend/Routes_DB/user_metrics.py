from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

TABLE_USER_METRICS = "user_metrics"

def db_insert_metrics(rows: List[Dict[str, Any]], *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_metrics.db_insert_metrics")
    res = sb.table(TABLE_USER_METRICS).insert(rows).execute()
    return res.data or []

def db_get_latest_metric(user_id: int, metric: str, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_metrics.db_get_latest_metric")
    res = (
        sb.table(TABLE_USER_METRICS)
        .select("*")
        .eq("user_id", user_id)
        .eq("metric", metric)
        .order("measured_at", desc=True)
        .limit(1)
        .execute()
    )

    print("db_get_latest_metric",metric,res)
    return res.data[0] if res.data else None

def db_get_metric_trend(user_id: int, metric: str, days: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="user_metrics.db_get_metric_trend")
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    res = (
        sb.table(TABLE_USER_METRICS)
        .select("value_num, measured_at")
        .eq("user_id", user_id)
        .eq("metric", metric)
        .gte("measured_at", since_date)
        .order("measured_at", desc=False) # Pre grafy vzostupne
        .execute()
    )

    print("db_get_metric_trend",metric,res)
    return res.data or []