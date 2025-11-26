# Routes_FE/coach_plan_db.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException, Query

from Services.coach_plan_log import (
    parse_iso_date,
    get_planned_range_rows,
    get_planned_sessions_filtered,
    upsert_ai_plan_for_user,
    cancel_plan_for_user,
    link_session_to_activity as service_link_session_to_activity,
)

# FE router pre /coach-plan/*
router = APIRouter(prefix="/coach-plan", tags=["coach-plan"])

# FE router pre /coach-plan-link/*
router_link = APIRouter(prefix="/coach-plan-link", tags=["coach-plan"])


# ========= RANGE (pre PlanDataProvider) =========


@router.get("/range/{user_id}")
def get_planned_range(
    user_id: int,
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
):
    """
    Načíta plánované tréningy pre užívateľa v rozsahu [start, end].

    Toto je endpoint, ktorý používa PlanDataProvider:
      GET /coach-plan/range/{user_id}?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    try:
        # validácia dátumov
        _ = parse_iso_date(start)
        _ = parse_iso_date(end)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        rows = get_planned_range_rows(user_id=user_id, start_iso=start, end_iso=end)
        return {
            "success": True,
            "rows": rows,  # PlanDataProvider číta data/rows
            "range": {"start": start, "end": end},
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ========= STARÝ GET (filtre date_from/date_to/plan_id) =========


@router.get("/{user_id}")
def get_planned_sessions(
    user_id: int,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    plan_id: Optional[str] = Query(None, description="Filter by plan_id"),
):
    """
    Načíta plánované tréningy pre užívateľa.
    Pôvodný endpoint:
      GET /coach-plan/{user_id}?date_from=...&date_to=...&plan_id=...
    """
    try:
        rows = get_planned_sessions_filtered(
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            plan_id=plan_id,
        )
        return {"success": True, "data": rows, "plan_id": plan_id}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ========= POST – uloženie AI plánu =========


@router.post("/{user_id}")
def upsert_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    """
    Uloží AI plán do planned_sessions.

    Payload:
    {
      "next_10_days": [ { "day": "YYYY-MM-DD", "sessions": [...] }, ... ],
      "meta": { ... }?,           # info o pláne (weeks, goal, start...)
      "overwrite": true | false
    }
    """
    next_10_days = payload.get("next_10_days") or []
    overwrite = bool(payload.get("overwrite", True))

    try:
        result = upsert_ai_plan_for_user(
            user_id=user_id,
            next_10_days=next_10_days,
            overwrite=overwrite,
        )
    except ValueError as e:
        # logická/validačná chyba → 400
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        # neočakávaná chyba → 500
        raise HTTPException(status_code=500, detail=str(e))

    start = result["start"]
    end = result["end"]

    return {
        "success": True,
        "plan_id": result["plan_id"],
        "inserted": result["inserted"],
        "date_range": {
            "from": start.isoformat(),
            "to": end.isoformat(),
        },
    }


# ========= DELETE – zrušenie plánu =========


@router.delete("/{user_id}")
def cancel_plan(
    user_id: int,
    payload: Optional[Dict[str, Any]] = Body(None),
):
    """
    Zruší aktívny plán:
      - ak príde plan_id → zmaže len daný plán
      - inak zmaže všetky AI planned sessions od dneška vrátane
    """
    plan_id: Optional[str] = None
    if isinstance(payload, dict):
        raw = payload.get("plan_id")
        if raw:
            plan_id = str(raw)

    try:
        deleted = cancel_plan_for_user(user_id=user_id, plan_id=plan_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "deleted": deleted}


# ========= NOVÉ – /coach-plan-link/{user_id} – manuálne mapovanie plán ↔ aktivita =========


@router_link.post("/{user_id}")
def save_plan_activity_link(
    user_id: int,  # pre debug/logy; samotný link je cez session_id
    payload: Dict[str, Any] = Body(...),
):
    """
    Ručné mapovanie planned session ↔ aktivita.

    Body:
      {
        "session_id": int,          # id z coach_planned_sessions
        "activity_id": int | null   # null → odmapovanie
      }
    """
    session_id = payload.get("session_id")
    if session_id is None:
        raise HTTPException(status_code=400, detail="session_id is required")

    try:
        session_id_int = int(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="session_id must be an integer")

    activity_id_raw = payload.get("activity_id", None)
    if activity_id_raw is None:
        activity_id: Optional[int] = None
    else:
        try:
            activity_id = int(activity_id_raw)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="activity_id must be an integer or null",
            )

    try:
        updated = service_link_session_to_activity(
            session_id=session_id_int,
            activity_id=activity_id,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": updated > 0,
        "updated": updated,
        "user_id": user_id,
        "session_id": session_id_int,
        "activity_id": activity_id,
    }