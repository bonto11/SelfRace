# Services/profile_metrics.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from Services.profile import (
    MetricKey,
    BatchMetricsPayload,
    _iso_now,
)
from Routes_DB.profile_metrics import (
    db_insert_metric_rows,
    db_get_metric_history,
    db_get_latest_metric,
    db_fetch_static_basic,
    db_get_vo2_measured_history,
    db_get_static_sex_birth,
)


# ---------- INSERT METRICS (batch) ----------


def service_insert_metrics(user_id: int, payload: BatchMetricsPayload) -> Dict[str, Any]:
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries provided")

    now_iso = _iso_now()
    rows: List[Dict[str, Any]] = []

    for e in payload.entries:
        try:
            v = float(e.value_num)
        except Exception:  # noqa: BLE001
            raise HTTPException(
                status_code=400, detail=f"Invalid value_num for metric {e.metric}"
            )

        rows.append(
            {
                "user_id": user_id if not payload.user_uid else None,
                "user_uid": payload.user_uid or None,
                "metric": e.metric,
                "value_num": v,
                "unit": e.unit,
                "measured_at": (
                    e.measured_at or datetime.now(timezone.utc)
                ).isoformat(),
                "source": e.source,
                "note": e.note,
                "created_at": now_iso,
            }
        )

    try:
        data = db_insert_metric_rows(rows)
        return {"success": True, "inserted": len(data or []), "data": data}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ---------- HISTORY jednej metriky ----------


def service_get_metric_history(
    user_id: int,
    metric: MetricKey,
    user_uid: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    data = db_get_metric_history(
        user_id=user_id,
        metric=str(metric),
        user_uid=user_uid,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return {"success": True, "metric": metric, "data": data}


# ---------- LATEST viac metrík + BMI ----------


def service_get_latest_metrics(
    user_id: int, user_uid: Optional[str] = None
) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    targets: List[str] = [
        "weight_kg",
        "body_fat_pct",
        "HR_max",
        "VO2Max_measured",
        "VO2Max_estimated",
    ]

    for key in targets:
        row = db_get_latest_metric(user_id=user_id, metric=key, user_uid=user_uid)
        out[key] = (
            {
                "value": row.get("value_num"),
                "unit": row.get("unit"),
                "updated_at": row.get("measured_at"),
            }
            if row
            else None
        )

    # BMI = posledná váha + výška zo static
    static = db_fetch_static_basic(user_id=user_id, user_uid=user_uid) or {}
    height_cm = static.get("height_cm")
    last_weight = (
        out.get("weight_kg", {}).get("value") if out.get("weight_kg") else None
    )

    if height_cm and last_weight:
        try:
            h_m = float(height_cm) / 100.0
            bmi = round(float(last_weight) / (h_m * h_m), 1)
            out["BMI"] = {
                "value": bmi,
                "unit": "kg/m²",
                "updated_at": out["weight_kg"]["updated_at"]
                if out.get("weight_kg")
                else None,
            }
        except Exception:  # noqa: BLE001
            out["BMI"] = None
    else:
        out["BMI"] = None

    return {"success": True, "data": out}


# ---------- VO2 kompat (history + estimate) ----------


def service_get_vo2_history(
    user_id: int, user_uid: Optional[str] = None
) -> Dict[str, Any]:
    try:
        hist = db_get_vo2_measured_history(user_id=user_id, user_uid=user_uid)
        stat = db_get_static_sex_birth(user_id=user_id, user_uid=user_uid) or {}

        history = [
            {"VO2Max": row["value_num"], "updated_at": row["measured_at"]}
            for row in (hist or [])
        ]

        return {
            "success": True,
            "history": history,
            "sex": stat.get("sex"),
            "birth_date": stat.get("birth_date"),
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


def service_get_vo2_estimate(
    user_id: int, user_uid: Optional[str] = None
) -> Dict[str, Any]:
    try:
        row = db_get_latest_metric(
            user_id=user_id, metric="VO2Max_estimated", user_uid=user_uid
        )
        return {
            "success": True,
            "value": row.get("value_num") if row else None,
            "updated_at": row.get("measured_at") if row else None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))