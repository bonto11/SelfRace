# Services/analytics.py

from __future__ import annotations

from typing import Any, Dict, List

from Routes_DB.activities_summary import (
    db_get_activity_summary_one,
)

from Routes_DB.activities_laps import (
    db_get_activity_laps,
)

from Routes_DB.activities_splits import (
    db_get_activity_splits,
)

from Routes_DB.activities_streams import (
    db_get_streams_one,
)

def service_get_streams_one(
    user_id: int,
    activity_id: int,
) -> Dict[str, Any]:
    """
    Vrátime vždy dict – ak v DB nič nie je,
    dostane FE prázdne polia.
    """
    row = db_get_streams_one(user_id=user_id, activity_id=activity_id)
    if not row:
        return {"time_s": [], "heartrate_bpm": []}
    return row

def service_get_activity_detail(activity_id: int) -> Dict[str, Any]:
    """
    FE: GET /activities/detail/{activity_id}
    """
    summary = db_get_activity_summary_one(activity_id)
    laps = db_get_activity_laps(activity_id)
    splits = db_get_activity_splits(activity_id)

    return {
        "summary": summary,
        "laps": laps or [],
        "splits": splits or [],
    }


def service_get_detail_one(activity_id: int) -> Dict[str, Any]:
    """
    FE: GET /activities/detail/one/{activity_id}
    """
    laps = db_get_activity_laps(activity_id)
    splits = db_get_activity_splits(activity_id)
    return {
        "laps": laps or [],
        "splits": splits or [],
    }
