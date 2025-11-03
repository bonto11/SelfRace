# src/routes/profile.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from Modules.SQL.db_handler import get_client

# POZOR: správna cesta je "service.profile" (nie "Services...")
from Services.profile import (
    MetricKey, MetricEntry, BatchMetricsPayload, StaticPayload,
    _iso_now, _birth_to_iso_date, _fetch_static, _fetch_latest_by_metric
)
from Configs.config import (
    TABLE_PROFILE_STATIC,
    TABLE_PROFILE_METRIC_VALUE,
)

router = APIRouter(prefix="/profile", tags=["profile"])
supabase = get_client()

# ====== STATIC ======
@router.get("/static/{user_id}")
def get_static(user_id: int):
    row = _fetch_static(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Static profile not found")
    return {"success": True, "data": row}

@router.post("/static/{user_id}")
def upsert_static(user_id: int, payload: StaticPayload):
    data = {
        "user_id": user_id,
        "sex": payload.sex,
        "birth_date": _birth_to_iso_date(payload.birth_date),
        "height_cm": payload.height_cm,
        "updated_at": _iso_now(),
    }
    try:
        res = supabase.table(TABLE_PROFILE_STATIC).upsert(data, on_conflict="user_id").execute()
        return {"success": True, "data": (res.data[0] if res.data else data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ====== METRICS – BATCH INSERT ======
@router.post("/metrics/{user_id}")
def insert_metrics(user_id: int, payload: BatchMetricsPayload):
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries provided")

    now_iso = _iso_now()
    rows = []
    for e in payload.entries:
        # základná sanitácia
        try:
            v = float(e.value_num)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid value_num for metric {e.metric}")

        rows.append({
            "user_id": user_id,
            "metric": e.metric,
            "value_num": v,
            "unit": e.unit,
            "measured_at": (e.measured_at or datetime.now(timezone.utc)).isoformat(),
            "source": e.source,
            "note": e.note,
            "created_at": now_iso,
        })

    try:
        res = supabase.table(TABLE_PROFILE_METRIC_VALUE).insert(rows).execute()
        return {"success": True, "inserted": len(res.data or []), "data": res.data or rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ====== METRICS – HISTORY (jedna metrika) ======
@router.get("/metrics/history/{user_id}")
def get_metric_history(
    user_id: int,
    metric: MetricKey = Query(..., description="metric key, e.g. weight_kg"),
    date_from: Optional[str] = Query(None, description="ISO date/datetime"),
    date_to: Optional[str] = Query(None, description="ISO date/datetime"),
    limit: Optional[int] = Query(None, ge=1, le=5000),
):
    q = (
        supabase.table(TABLE_PROFILE_METRIC_VALUE)
        .select("metric,value_num,unit,measured_at,source,note")
        .eq("user_id", user_id)
        .eq("metric", metric)
        .order("measured_at", desc=False)
    )
    if date_from:
        q = q.gte("measured_at", date_from)
    if date_to:
        q = q.lte("measured_at", date_to)
    if limit:
        q = q.limit(limit)

    res = q.execute()
    return {"success": True, "metric": metric, "data": res.data}

# ====== METRICS – LATEST (viac metrík + BMI v BE) ======
@router.get("/metrics/latest/{user_id}")
def get_latest_metrics(user_id: int):
    out: Dict[str, Any] = {}
    targets: List[str] = [
        "weight_kg", "body_fat_pct", "HR_max", "VO2Max_measured", "VO2Max_estimated",
    ]

    for key in targets:
        row = _fetch_latest_by_metric(user_id, key)
        out[key] = (
            {"value": row.get("value_num"), "unit": row.get("unit"), "updated_at": row.get("measured_at")}
            if row else None
        )

    # BMI = posledná váha + výška zo static
    static = _fetch_static(user_id)
    height_cm = static.get("height_cm")
    last_weight = out.get("weight_kg", {}).get("value") if out.get("weight_kg") else None

    if height_cm and last_weight:
        try:
            h_m = float(height_cm) / 100.0
            bmi = round(float(last_weight) / (h_m * h_m), 1)
            out["BMI"] = {
                "value": bmi,
                "unit": "kg/m²",
                "updated_at": out["weight_kg"]["updated_at"] if out.get("weight_kg") else None,
            }
        except Exception:
            out["BMI"] = None
    else:
        out["BMI"] = None

    return {"success": True, "data": out}

# ====== VO2 – KOMPAT ENDPOINTY ======
@router.get("/vo2-history/{user_id}")
def get_vo2_history(user_id: int):
    try:
        hist = (
            supabase.table(TABLE_PROFILE_METRIC_VALUE)
            .select("value_num,measured_at")
            .eq("user_id", user_id)
            .eq("metric", "VO2Max_measured")
            .order("measured_at", desc=False)
            .execute()
        )

        static = (
            supabase.table(TABLE_PROFILE_STATIC)
            .select("sex,birth_date")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        history = [
            {"VO2Max": row["value_num"], "updated_at": row["measured_at"]}
            for row in (hist.data or [])
        ]

        return {
            "success": True,
            "history": history,
            "sex": static.data[0]["sex"] if static.data else None,
            "birth_date": static.data[0]["birth_date"] if static.data else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vo2-estimate/{user_id}")
def get_vo2_estimate(user_id: int):
    try:
        row = _fetch_latest_by_metric(user_id, "VO2Max_estimated")
        return {
            "success": True,
            "value": row.get("value_num") if row else None,
            "updated_at": row.get("measured_at") if row else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))