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

from Routes_DB.activites_streams import (
    db_get_streams_hr_rows,
)


def service_get_streams_one(activity_id: int) -> List[Dict[str, Any]]:
    return db_get_streams_hr_rows(activity_id)


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
