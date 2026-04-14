# Routes_FE/coach_external_events.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, Query, Depends, Header, Request

from Services.coach_external_events import (
    service_list_external_events,
    service_save_external_events,
    service_list_external_events_window,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(tags=["coach_external_events"])


@router.post("/coach-external-events/{user_id}")
def api_save_external_events(
    req: Request,
    user_id: int,
    payload: Dict[str, Any] = Body(...),
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
        ctx = require_user(get_auth_ctx(req))

        return service_save_external_events(
            user_id=user_id,
            events=events,
            ctx=ctx,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] save error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to save external events")


@router.get("/coach-external-events/{user_id}")
def api_get_external_events(
    req: Request,
    user_id: int,
) -> Dict[str, Any]:
    """
    GET: vráti externé eventy pre usera.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        return service_list_external_events(
            user_id=user_id,
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] get error:", repr(e))
        raise HTTPException(status_code=500, detail="Failed to load external events")


@router.get("/coach-external-events/{user_id}/window")
def api_get_external_events_window(
    req: Request,
    user_id: int,
    from_iso: str = Query(..., alias="from"),
    to_iso: str = Query(..., alias="to"),
) -> Dict[str, Any]:
    """
    GET: vráti externé eventy expandované na konkrétne dni v intervale [from, to].

    Query:
      - from: "YYYY-MM-DD"
      - to:   "YYYY-MM-DD"
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        return service_list_external_events_window(
            user_id=user_id,
            from_iso=from_iso,
            to_iso=to_iso,
            ctx=ctx,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:  # noqa: BLE001
        print("[API-COACH-EXT] window error:", repr(e))
        raise HTTPException(
            status_code=500, detail="Failed to load external events window"
        )
