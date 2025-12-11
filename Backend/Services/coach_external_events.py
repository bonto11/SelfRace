# Services/coach_external_events.py
from __future__ import annotations

from typing import Any, Dict, List

from Routes_DB.coach_external_events import (
    db_list_external_events_for_user,
    db_clear_external_events_for_user,
    db_insert_external_events,
)


def _normalize_event_input(
    user_id: int,
    ev: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Normalizácia jedného eventu z FE.
    """
    weekday = int(ev.get("weekday") or 0)
    if weekday < 1 or weekday > 7:
        raise ValueError("weekday must be between 1 and 7")

    return {
        "user_id": user_id,
        "title": str(ev.get("title") or "").strip() or "Externá aktivita",
        "sport": ev.get("sport") or None,
        "weekday": weekday,
        "duration_min": int(ev["duration_min"]) if ev.get("duration_min") is not None else None,
        "priority": ev.get("priority") or "fixed",
        "notes": ev.get("notes") or None,
        "start_date": ev.get("start_date") or None,
        "end_date": ev.get("end_date") or None,
    }


def service_list_external_events(user_id: int) -> Dict[str, Any]:
    """
    Vráti zoznam externých eventov pre usera.
    """
    rows = db_list_external_events_for_user(user_id)
    return {
        "success": True,
        "events": rows,
    }


def service_save_external_events(
    user_id: int,
    *,
    events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Overwrite save:
      - zmaže všetky existujúce eventy usera
      - vloží nové podľa payloadu
    """
    norm_rows: List[Dict[str, Any]] = []
    for raw in events:
        norm_rows.append(_normalize_event_input(user_id, raw))

    # vyčisti existujúce eventy
    deleted = db_clear_external_events_for_user(user_id)

    # insert new
    inserted = db_insert_external_events(norm_rows)

    return {
        "success": True,
        "deleted": deleted,
        "inserted": inserted,
        "count": len(norm_rows),
    }