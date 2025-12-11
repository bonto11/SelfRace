# Routes/coach_external_events.py
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Body, HTTPException

from Services.coach_external_events import (
    service_list_external_events,
    service_save_external_events,
)

router = APIRouter(tags=["coach_external_events"])


@router.get("/coach-external-events/{user_id}")
def api_get_external_events(user_id: int) -> Dict[str, Any]:
    """
    GET: vráti externé eventy pre usera.
    """
    try:
        return service_list_external_events(user_id=user_id)
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] get error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to load external events")


@router.post("/coach-external-events/{user_id}")
def api_save_external_events(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    """
    POST: overwrite save externých eventov.

    Body:
      { "events": [ { title, sport, weekday, duration_min, priority, notes, start_date, end_date }, ... ] }
    """
    events = payload.get("events")
    if not isinstance(events, list):
        raise HTTPException(status_code=400, detail="events must be a list")

    try:
        return service_save_external_events(user_id=user_id, events=events)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] save error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to save external events")