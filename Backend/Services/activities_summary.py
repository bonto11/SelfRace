# Services/activities.py

from __future__ import annotations

from datetime import datetime, timedelta, timezone, time, date
from typing import Any, Dict, List

from Services.time import parse_date_ymd
from Routes_DB.activities_summary import (
    db_get_activities_recent,
    db_get_activity_summary_one,
    db_get_activities_in_range_basic,
    db_select_activities_window_basic,
    db_get_summary_one,
)

def service_get_activities(user_id: int, days: int = 30) -> List[Dict[str, Any]]:
    """
    FE: GET /activities/{user_id}?days=30
    """
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    return db_get_activities_recent(user_id, since_date)

def service_activities_in_range(
    user_id: int,
    start: str,
    end: str,
) -> Dict[str, Any]:
    """
    FE: GET /activities/range/{user_id}?start=YYYY-MM-DD&end=YYYY-MM-DD
    """
    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)

    start_ts = datetime.combine(start_d, time(0, 0, 0, tzinfo=timezone.utc))
    end_ts = datetime.combine(end_d, time(0, 0, 0, tzinfo=timezone.utc)) + timedelta(days=1)

    rows = db_get_activities_in_range_basic(
        user_id=user_id,
        start_ts_iso=start_ts.isoformat(),
        end_ts_iso=end_ts.isoformat(),
    )

    return {
        "data": rows,
        "range": {
            "start": start_d.isoformat(),
            "end": end_d.isoformat(),
        },
    }


def service_select_activities(
    user_id: int,
    date_str: str,
    delta_days: int,
    sports_csv: str,
) -> Dict[str, Any]:
    """
    FE: GET /activities/select/{user_id}
    """
    center = parse_date_ymd(date_str)
    date_from = (center - timedelta(days=delta_days)).isoformat()
    date_to = (center + timedelta(days=delta_days)).isoformat()
    sport_list = [s.strip() for s in sports_csv.split(",") if s.strip()]

    rows = db_select_activities_window_basic(
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        sports=sport_list or None,
    )

    items: List[Dict[str, Any]] = []
    for r in rows:
        distance_m = r.get("distance_m")
        moving_s = r.get("moving_time_s")
        items.append(
            {
                "id": r.get("activity_id"),
                "name": r.get("name") or "",
                "start_date": r.get("date"),
                "sport": r.get("sport_type_fe"),
                "distance_km": (distance_m or 0) / 1000 if distance_m is not None else None,
                "duration_min": (moving_s or 0) / 60 if moving_s is not None else None,
            }
        )

    return {
        "count": len(items),
        "items": items,
    }


def service_get_summary_one(activity_id: int) -> Dict[str, Any]:
    """
    FE: GET /activities/summary/one/{activity_id}
    """
    row = db_get_summary_one(activity_id)
    if not row:
        raise ValueError("activity not found")
    return row