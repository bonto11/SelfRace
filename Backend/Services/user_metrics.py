from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from DB.user_metrics import (
    db_insert_metrics,
    db_get_latest_metric,
    db_get_metric_trend
)
from DB.profile_static import db_get_static_sex_birth
from Modules.Supabase.auth import AuthCtx

# --- VO2 MAX MEASURED (z hodiniek/laboratória) ---

def service_get_vo2_measured_latest(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    row = db_get_latest_metric(user_id, "vo2max_measured", ctx=ctx)
    static = db_get_static_sex_birth(user_id, ctx=ctx) or {}
    return {
        "value": row["value_num"] if row else None,
        "measured_at": row["measured_at"] if row else None,
        "sex": static.get("sex"),
        "birth_date": static.get("birth_date")
    }

def service_get_vo2_measured_trend(user_id: int, days: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_metric_trend(user_id, "vo2max_measured", days, ctx=ctx)

# --- VO2 MAX ESTIMATED (výpočet od AI) ---

def service_get_vo2_estimated_latest(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    row = db_get_latest_metric(user_id, "vo2max_estimated", ctx=ctx)
    return {
        "value": row["value_num"] if row else None,
        "measured_at": row["measured_at"] if row else None
    }

def service_get_vo2_estimated_trend(user_id: int, days: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_metric_trend(user_id, "vo2max_estimated", days, ctx=ctx)

# --- BODY FAT ---

def service_get_body_fat_latest(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    row = db_get_latest_metric(user_id, "body_fat_pct", ctx=ctx)
    static = db_get_static_sex_birth(user_id, ctx=ctx) or {}
    return {
        "value": row["value_num"] if row else None,
        "measured_at": row["measured_at"] if row else None,
        "sex": static.get("sex")
    }

def service_get_body_fat_trend(user_id: int, days: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_metric_trend(user_id, "body_fat_pct", days, ctx=ctx)

# --- SAVE (Univerzálny) ---

def service_save_metric(
    user_id: int, 
    metric: str, 
    value: float, 
    ctx: AuthCtx, 
    unit: Optional[str] = None # OPRAVA: Pylance error fix
) -> Dict[str, Any]:
    row = {
        "user_id": user_id,
        "metric": metric.lower(),
        "value_num": value,
        "unit": unit,
        "measured_at": datetime.now(timezone.utc).isoformat()
    }
    res = db_insert_metrics([row], ctx=ctx)
    return res[0] if res else {}