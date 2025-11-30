from __future__ import annotations

from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Body, HTTPException, Query

from Services.coach_plan_log import (
    service_parse_iso_date,
    service_get_planned_range_rows,
    service_get_planned_sessions_filtered,
    service_upsert_ai_plan_for_user,
    service_cancel_plan_for_user,
    service_link_session_to_activity,
    service_reorder_planned_sessions,
    service_extend_active_plan,
)
from Services.coach_plan_upgrade import service_extend_active_plan

# JEDEN router pre všetko okolo coach-planu
router = APIRouter(prefix="/coach-plan", tags=["coach-plan"])


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
        _ = service_parse_iso_date(start)
        _ = service_parse_iso_date(end)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        rows = service_get_planned_range_rows(
            user_id=user_id,
            start_iso=start,
            end_iso=end,
        )
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
        rows = service_get_planned_sessions_filtered(
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
        result = service_upsert_ai_plan_for_user(
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
        deleted = service_cancel_plan_for_user(user_id=user_id, plan_id=plan_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "deleted": deleted}


# ========= LINK – manuálne mapovanie plán ↔️ aktivita =========


@router.post("/{user_id}/link")
def save_plan_activity_link(
    user_id: int,  # pre debug/logy; samotný link je cez session_id
    payload: Dict[str, Any] = Body(...),
):
    """
    Ručné mapovanie planned session ↔️ aktivita.

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


# ========= REORDER – batch presun tréningov (drag & drop) =========


@router.post("/{user_id}/reorder")
def reorder_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    """
    Batch presun tréningov v pláne (drag & drop board).

    Body:
    {
      "updates": [
        { "id": int, "plan_date": "YYYY-MM-DD", "session_index": int },
        ...
      ]
    }
    """
    updates = payload.get("updates")
    if not isinstance(updates, list) or not updates:
        raise HTTPException(
            status_code=400,
            detail="updates must be a non-empty list",
        )

    try:
        updated = service_reorder_planned_sessions(user_id=user_id, updates=updates)
    except ValueError as e:
        # typicky invalid date -> 400
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": True,
        "updated": updated,
        "user_id": user_id,
        "count": len(updates),
    }



@router.post("/{user_id}/extend")
def extend_plan(
    user_id: int,
    min_horizon_days: int = Query(10, ge=1, le=30),
):
    """
    Rozšíri aktívny plán tak, aby mal aspoň `min_horizon_days` dní dopredu.
    FE očakáva:
      {
        success: bool,
        extended_days: int,
        plan_start: str,
        plan_end: str,
        horizon_days: int,
        inserted_rows?: int,
        note?: str
      }
    """
    try:
      # raw result zo service
        raw = service_extend_active_plan(
            user_id=user_id,
            min_horizon_days=min_horizon_days,
        )
        # raw má pravdepodobne tvar:
        # {
        #   "plan_id": ...,
        #   "extended_days": int,
        #   "inserted_sessions": int,
        #   "old_end": "YYYY-MM-DD",
        #   "new_end": "YYYY-MM-DD",
        #   "horizon_days": int,
        #   "need_days": int,
        #   "note": str,
        # }

        plan_start = raw.get("plan_start") or raw.get("start_iso") or ""
        plan_end = raw.get("plan_end") or raw.get("new_end") or raw.get("old_end") or ""

        return {
            "success": True,
            "extended_days": int(raw.get("extended_days") or 0),
            "plan_start": plan_start,
            "plan_end": plan_end,
            "horizon_days": int(raw.get("horizon_days") or 0),
            "inserted_rows": int(raw.get("inserted_sessions") or 0),
            "note": raw.get("note") or "",
        }
    except ValueError as e:
        # napr. keď user nemá žiadny aktívny plán
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))