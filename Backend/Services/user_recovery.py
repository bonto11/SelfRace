from __future__ import annotations

from typing import List, Dict, Any
from fastapi import HTTPException

from Routes_DB.user_recovery import (
    db_get_recovery_record,
    db_insert_recovery,
    db_update_recovery,
    db_get_recent_recovery,
)

from Modules.Supabase.auth import AuthCtx

# kľúče ktoré nikdy nesmú ísť do update patchu
_ID_KEYS = {"id", "user_id", "date", "created_at", "updated_at"}


def service_insert_or_update_recovery(
    payload: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    PATCH semantics:
    - payload obsahuje len polia ktoré prišli z FE (route robí exclude_unset=True)
    - ak je field v payload a je None -> zmaž v DB (explicitne)
    - ak field nie je v payload -> DB sa ho nedotkne
    """

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    if "user_id" not in payload:
        raise HTTPException(status_code=422, detail="Missing user_id")
    if "date" not in payload or not payload.get("date"):
        # ⚠️ nerob fallback na 'dnes' – user by nevedel čo updatuje
        raise HTTPException(status_code=422, detail="Missing date")

    user_id = int(payload["user_id"])
    date_iso = str(payload["date"])[:10]

    # ✅ patch = iba polia ktoré chceme uložiť (bez identity)
    patch: Dict[str, Any] = {
        k: v for k, v in payload.items() if k not in _ID_KEYS
    }

    existing = db_get_recovery_record(user_id, date_iso, ctx=ctx)

    if existing:
        rec_id = int(existing["id"])

        # nič na update? tak len vráť že existuje
        if not patch:
            return {"updated": True, "row": {"id": rec_id, "user_id": user_id, "date": date_iso}}

        return {
            "updated": True,
            "row": db_update_recovery(rec_id, patch, ctx=ctx),
        }

    # insert: musí obsahovať identity + patch (aj keby bol prázdny)
    insert_row: Dict[str, Any] = {"user_id": user_id, "date": date_iso, **patch}

    return {
        "updated": False,
        "row": db_insert_recovery(insert_row, ctx=ctx),
    }
def service_get_recovery(
    user_id: int,
    ctx: AuthCtx,
    days: int = 14,
) -> List[Dict[str, Any]]:

    return db_get_recent_recovery(
        user_id,
        days,
        ctx=ctx,
    )


def service_build_recovery_block_for_analysis(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Blok pre CoachAnalyzeInput["recovery"].

    Režimy:
      - service=False: RLS klient (require_jwt).
      - service=True: service klient (user_jwt forward, bez require_jwt).
    """

    rows = db_get_recent_recovery(
        user_id,
        days=21,
        ctx=ctx,
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