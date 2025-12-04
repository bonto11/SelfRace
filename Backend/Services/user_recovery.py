# Services/user_recovery.py
from __future__ import annotations
from datetime import datetime
from typing import List, Dict, Any

from Routes_DB.user_recovery import (
    db_get_recovery_record,
    db_insert_recovery,
    db_update_recovery,
    db_get_recent_recovery,
)
from Routes_DB.users import db_get_user_by_auth_uid


def service_insert_or_update_recovery(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Vloží alebo updatuje recovery záznam podľa (user_id, date).
    Vracia nový/aktualizovaný riadok.
    """
    user_id = payload["user_id"]
    date_iso = payload.get("date") or datetime.now().date().isoformat()

    # auth_uid pre traceability
    auth_uid = db_get_user_by_auth_uid(str(user_id))
    if not auth_uid:
        raise RuntimeError("User not found (missing auth_uid)")

    # existujúci záznam?
    existing = db_get_recovery_record(user_id, date_iso)

    row = payload.copy()
    row["date"] = date_iso
    row["user_uid"] = auth_uid

    if existing:
        rec_id = existing["id"]
        return {"updated": True, "row": db_update_recovery(rec_id, row)}
    else:
        return {"updated": False, "row": db_insert_recovery(row)}


def service_get_recovery(user_id: int, days: int = 14) -> List[Dict[str, Any]]:
    return db_get_recent_recovery(user_id, days)

def service_build_recovery_block_for_analysis(user_id: int) -> Dict[str, Any]:
    rows = db_get_recent_recovery(user_id, days=21)
    if not rows:
        return {
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        }

    # --- Najnovší záznam ---
    latest = rows[0]

    rhr = latest.get("RHR_bpm")
    hrv = latest.get("HRV_avg_ms")
    sleep = latest.get("sleep_duration_min")

    # --- HRV TREND: posledných 7 dní, len validné čísla ---
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