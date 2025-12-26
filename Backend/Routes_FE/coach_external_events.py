# Routes_FE/coach_external_events.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, Query, Depends, Header

from Services.coach_external_events import (
    service_list_external_events,
    service_save_external_events,
    service_list_external_events_window,
)

router = APIRouter(tags=["coach_external_events"])


def get_user_jwt_from_header(authorization: str = Header(...)) -> str:
    """
    Vytiahne user JWT z Authorization headeru ("Bearer <token>").
    Očakáva, že FE ho tam pošle (callBackend s access_tokenom).
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    return parts[1].strip()


@router.post("/coach-external-events/{user_id}")
def api_save_external_events(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
    user_jwt: str = Depends(get_user_jwt_from_header),
) -> Dict[str, Any]:
    """
    POST: overwrite save externých eventov (RLS, via user_jwt).

    Body:
      {
        "events": [
          {
            title,
            sport,
            weekday,
            duration_min,
            priority,
            notes,
            start_date,
            end_date,
            recurrence_kind,
            single_date,
            start_time_local
          },
          ...
        ]
      }
    """
    events = payload.get("events")
    if not isinstance(events, list):
        raise HTTPException(status_code=400, detail="events must be a list")

    try:
        return service_save_external_events(
            user_id=user_id,
            events=events,
            user_jwt=user_jwt,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] save error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to save external events")


@router.get("/coach-external-events/{user_id}")
def api_get_external_events(
    user_id: int,
    user_jwt: str = Depends(get_user_jwt_from_header),
) -> Dict[str, Any]:
    """
    GET: vráti externé eventy pre usera.
    """
    try:
        return service_list_external_events(
            user_id=user_id,
            user_jwt=user_jwt,
        )
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] get error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to load external events")


@router.get("/coach-external-events/{user_id}/window")
def api_get_external_events_window(
    user_id: int,
    from_iso: str = Query(..., alias="from"),
    to_iso: str = Query(..., alias="to"),
    user_jwt: str = Depends(get_user_jwt_from_header),
) -> Dict[str, Any]:
    """
    GET: vráti externé eventy expandované na konkrétne dni v intervale [from, to].

    Query:
      - from: "YYYY-MM-DD"
      - to:   "YYYY-MM-DD"
    """
    try:
        return service_list_external_events_window(
            user_id=user_id,
            from_iso=from_iso,
            to_iso=to_iso,
            user_jwt=user_jwt,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] window error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to load external events window")