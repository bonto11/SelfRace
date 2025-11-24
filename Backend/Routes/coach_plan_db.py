# Routes/coach_plan_db.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4
from datetime import date

from fastapi import APIRouter, Body, HTTPException, Query

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLAN_LOG

router = APIRouter(prefix="/coach", tags=["coach-plan"])
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

@router.get("/plan/{user_id}")
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
        print(f"[coach-plan] GET plan user_id={user_id}, plan_id={plan_id}, "
              f"date_from={date_from}, date_to={date_to}")

        q = (
            supabase.table(TABLE_COACH_PLAN_LOG)
            .select("*")
            .eq("user_id", user_id)
        )

        if plan_id:
            q = q.eq("plan_id", plan_id)
        if date_from:
            q = q.gte("plan_date", date_from)
        if date_to:
            q = q.lte("plan_date", date_to)

        q = q.order("plan_date", desc=False)
        try:
            q = q.order("session_index", desc=False)
        except Exception:
            pass

        res = q.execute()
        print(f"[coach-plan] GET rows={len(res.data or [])}")
        return {
            "success": True,
            "data": res.data,
            "plan_id": plan_id,
        }
    except Exception as e:
        print(f"[coach-plan] GET error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====== WRITE – uloženie plánu z AI ======

@router.post("/plan/{user_id}")
def upsert_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    """
    Uloží AI plán do planned_sessions.

    Očakávaný payload z FE:
    {
      "next_10_days": [
        { "day": "YYYY-MM-DD", "sessions": [ { ...session... }, ... ] },
        ...
      ],
      "meta": { ...ľubovoľné meta info... },
      "overwrite": true | false   // default true
    }
    """
    print(f"[coach-plan] POST user_id={user_id} payload_keys={list(payload.keys())}")

    days = payload.get("next_10_days") or []
    if not isinstance(days, list) or not days:
        raise HTTPException(
            status_code=400,
            detail="next_10_days is required and must be a non-empty array",
        )

    overwrite: bool = bool(payload.get("overwrite", True))
    meta = payload.get("meta") or {}

    # dátumový rozsah
    all_dates: List[date] = []
    for d in days:
        if not isinstance(d, dict) or "day" not in d:
            raise HTTPException(
                status_code=400,
                detail="Invalid entry in next_10_days (missing 'day')",
            )
        all_dates.append(_parse_iso_date(str(d["day"])))

    start_d = min(all_dates)
    end_d = max(all_dates)
    plan_id = str(uuid4())

    print(f"[coach-plan] POST plan_id={plan_id} range={start_d}..{end_d} "
          f"overwrite={overwrite}")

    # vyčistiť existujúci plán v rozsahu
    if overwrite:
        try:
            (
                supabase.table(TABLE_COACH_PLAN_LOG)
                .delete()
                .eq("user_id", user_id)
                .gte("plan_date", start_d.isoformat())
                .lte("plan_date", end_d.isoformat())
                .execute()
            )
            print("[coach-plan] POST cleared existing rows in range")
        except Exception as e:
            print(f"[coach-plan] POST clear error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to clear existing plan: {e}",
            )

    rows: List[Dict[str, Any]] = []

    for d in days:
        day_str = str(d["day"])
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid 'sessions' for day {day_str}",
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
                "plan_id": plan_id,
                "session_type": session_type,
                "session_index": idx,
                "payload": {
                    **sess,
                    "_plan_meta": meta,  # meta si uložíme k payloadu
                },
                "activity_id": None,
            }
            rows.append(row)

    if not rows:
        raise HTTPException(status_code=400, detail="No sessions to save")

    try:
        print(f"[coach-plan] POST inserting rows={len(rows)}")
        res = supabase.table(TABLE_COACH_PLAN_LOG).insert(rows).execute()
        inserted = len(res.data or rows)
        print(f"[coach-plan] POST inserted={inserted}")
    except Exception as e:
        print(f"[coach-plan] POST insert error: {e}")
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