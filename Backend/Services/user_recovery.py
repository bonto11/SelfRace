# Services/user_recovery.py
from __future__ import annotations

from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import HTTPException

from Routes_DB.user_recovery import (
    db_get_recovery_record,
    db_insert_recovery,
    db_update_recovery,
    db_get_recent_recovery,
)


def _require_jwt(user_jwt: Optional[str]) -> str:
    if not user_jwt:
        # recovery vždy cez RLS
        raise HTTPException(status_code=401, detail="Missing Authorization JWT")
    return user_jwt


def service_insert_or_update_recovery(
    payload: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vloží alebo updatuje recovery záznam podľa (user_id, date).
    Vracia nový/aktualizovaný riadok.
    """
    user_jwt = _require_jwt(user_jwt)

    user_id = payload["user_id"]
    date_iso = payload.get("date") or datetime.now().date().isoformat()

    print(
        "[service_insert_or_update_recovery]",
        "user_id=", user_id,
        "jwt_present=", bool(user_jwt),
    )

    existing = db_get_recovery_record(
        user_id,
        date_iso,
        user_jwt=user_jwt,
    )

    row = payload.copy()
    row["date"] = date_iso
    row["user_id"] = user_id

    if existing:
        rec_id = existing["id"]
        return {
            "updated": True,
            "row": db_update_recovery(
                rec_id,
                row,
                user_jwt=user_jwt,
            ),
        }
    else:
        return {
            "updated": False,
            "row": db_insert_recovery(
                row,
                user_jwt=user_jwt,
            ),
        }


def service_get_recovery(
    user_id: int,
    days: int = 14,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    user_jwt = _require_jwt(user_jwt)

    print(
        "[service_get_recovery]",
        "user_id=", user_id,
        "jwt_present=", bool(user_jwt),
    )

    return db_get_recent_recovery(
        user_id,
        days,
        user_jwt=user_jwt,
    )


def service_build_recovery_block_for_analysis(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Blok pre CoachAnalyzeInput["recovery"].
    """
    user_jwt = _require_jwt(user_jwt)

    rows = db_get_recent_recovery(
        user_id,
        days=21,
        user_jwt=user_jwt,
    )
    if not rows:
        return {
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        }

    latest = rows[0]

    rhr = latest.get("RHR_bpm")
    hrv = latest.get("HRV_avg_ms")
    sleep = latest.get("sleep_duration_min")

    # HRV TREND: posledných 7 dní
    raw_vals = [r.get("HRV_avg_ms") for r in rows[:7]]
    hrv_vals = [v for v in raw_vals if isinstance(v, (int, float)) and v > 0]

    trend = None
    if len(hrv_vals) >= 3:
        newest = hrv_vals[-1]
        oldest = hrv_vals[0]

        if newest > oldest + 5:
            trend = "up"
        elif newest < oldest - 5:
            trend = "down"
        else:
            trend = "stable"

    return {
        "rhr_bpm": rhr,
        "hrv_avg": hrv,
        "hrv_trend": trend,
        "sleep_ok": (sleep is not None and sleep >= 360),  # 6h+
        "last_illness_days_ago": None,
    }