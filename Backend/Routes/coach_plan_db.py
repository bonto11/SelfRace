# Routes/coach_save_plan.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4
from datetime import date

from fastapi import APIRouter, Body, HTTPException, Query

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLANNED_SESSIONS, TABLE_COACH_TRAINING_LOG

router = APIRouter(prefix="/coach-plan", tags=["coach-plan"])
supabase = get_client()


# ====== HELPERY ======


def _parse_iso_date(s: str) -> date:
    try:
        y, m, d = map(int, s.split("-"))
        return date(y, m, d)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date: {s}")


def _canonical_sport(sport: Any) -> str:
    s = str(sport or "").lower()
    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"
    if s not in ("run", "ride", "strength", "swim", "other"):
        return "other"
    return s


def _hr_zone_text(sess: Dict[str, Any]) -> Optional[str]:
    hr = sess.get("target_hr_bpm_range")
    if isinstance(hr, list) and len(hr) == 2:
        try:
            low, high = int(hr[0]), int(hr[1])
            return f"HR {low}–{high}"
        except Exception:
            return None
    return None


# ====== READ – načítanie plánu ======


@router.get("/{user_id}")
def get_planned_sessions(
    user_id: int,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    plan_id: Optional[str] = Query(None, description="Filter by plan_id"),
):
    """
    Načíta plánované tréningy pre užívateľa.
    - voliteľne filter podľa date_from/date_to
    - voliteľne filter podľa plan_id
    """
    try:
        q = (
            supabase.table(TABLE_COACH_PLANNED_SESSIONS)
            .select("*")
            .eq("user_id", user_id)
        )

        if plan_id:
            q = q.eq("plan_id", plan_id)
        if date_from:
            q = q.gte("plan_date", date_from)
        if date_to:
            q = q.lte("plan_date", date_to)

        # ak máš session_index stĺpec, udržuj poradie v rámci dňa
        q = q.order("plan_date", desc=False)
        try:
            q = q.order("session_index", desc=False)
        except Exception:
            # ak session_index ešte nemáš, supabase order naň spadne – ignoruj
            pass

        res = q.execute()
        return {
            "success": True,
            "data": res.data,
            "plan_id": plan_id,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ====== WRITE – uloženie plánu z AI ======


@router.post("/{user_id}")
def upsert_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    """
    Uloží AI plán do planned_sessions.

    Očakávaný payload z FE (napr. rovno z result.analysis):
    {
      "next_10_days": [
        { "day": "YYYY-MM-DD", "sessions": [ { ...session... }, ... ] },
        ...
      ],
      "overwrite": true | false   // default true
    }

    Každý session objekt môže obsahovať:
    - title, sport, duration_min, intensity, session_type, target_hr_bpm_range,
      structure, notes, exercises, ...
    Všetko sa navyše uloží kompletne aj do stĺpca `payload` (jsonb).
    """
    days = payload.get("next_10_days") or []
    if not isinstance(days, list) or not days:
        raise HTTPException(
            status_code=400,
            detail="next_10_days is required and must be a non-empty array",
        )

    overwrite: bool = bool(payload.get("overwrite", True))

    # vyhodnotíme dátumový rozsah pre prípadný overwrite
    all_dates: List[date] = []
    for d in days:
        if not isinstance(d, dict) or "day" not in d:
            raise HTTPException(
                status_code=400, detail="Invalid entry in next_10_days (missing 'day')"
            )
        all_dates.append(_parse_iso_date(str(d["day"])))

    start_d = min(all_dates)
    end_d = max(all_dates)

    plan_id = str(uuid4())

    # ak overwrite, zmažeme existujúce plánované sessions v tomto rozsahu
    if overwrite:
        try:
            (
                supabase.table(TABLE_COACH_PLANNED_SESSIONS)
                .delete()
                .eq("user_id", user_id)
                .gte("plan_date", start_d.isoformat())
                .lte("plan_date", end_d.isoformat())
                .execute()
            )
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"Failed to clear existing plan: {e}"
            )

    rows: List[Dict[str, Any]] = []

    for d in days:
        day_str = str(d["day"])
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            raise HTTPException(
                status_code=400, detail=f"Invalid 'sessions' for day {day_str}"
            )

        for idx, sess in enumerate(sessions):
            if not isinstance(sess, dict):
                continue

            sport = _canonical_sport(sess.get("sport"))
            title = sess.get("title") or None
            duration = sess.get("duration_min")
            intensity = sess.get("intensity")
            session_type = sess.get("session_type") or None
            notes = sess.get("notes") or None
            zone_text = _hr_zone_text(sess)

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_str,
                "sport": sport,
                "title": title,
                "duration_min": duration,
                "intensity": intensity,
                "zone_text": zone_text,
                "structure": sess.get("structure"),
                "notes": notes,
                "source": "ai",
                # nové polia
                "plan_id": plan_id,
                "session_type": session_type,
                "session_index": idx,
                "payload": sess,  # celé AI session telo
            }
            rows.append(row)

    if not rows:
        raise HTTPException(status_code=400, detail="No sessions to save")

    try:
        res = supabase.table(TABLE_COACH_PLANNED_SESSIONS).insert(rows).execute()
        inserted = len(res.data or rows)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Insert failed: {e}")

    return {
        "success": True,
        "plan_id": plan_id,
        "inserted": inserted,
        "date_range": {
            "from": start_d.isoformat(),
            "to": end_d.isoformat(),
        },
    }
