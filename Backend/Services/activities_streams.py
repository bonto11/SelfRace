from __future__ import annotations

from typing import Any, Dict, List, Optional

from Routes_DB.activities_streams import (
    db_get_streams_one,
)


def service_get_streams_one(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: str,
) -> Dict[str, Any]:
    """
    Vrátime vždy dict – ak v DB nič nie je,
    dostane FE prázdne polia.
    """
    row = db_get_streams_one(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=user_jwt,
    )
    if not row:
        return {"time_s": [], "heartrate_bpm": []}
    return row