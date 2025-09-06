from typing import Dict, Any, Optional

from backend.Modules.config import STRAVA_BASE
from .auth import get_access_token, _auth_headers
from .client import _request_json
from .cache import _maybe_load_or_cache


def get_activity_detail(
    activity_id: int, token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Legacy streamy – len základné kľúče.
    """
    filename = f"streams_{activity_id}.json"

    def _fetch():
        tok = token or get_access_token()
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}/streams",
            headers=_auth_headers(tok),
            params={
                "keys": "time,latlng,altitude,heartrate,cadence,velocity_smooth",
                "key_by_type": "true",
            },
            timeout=60,
        )

    return _maybe_load_or_cache(filename, _fetch)


def get_activity_streams_all(
    activity_id: int, token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Streamy (time-series). Širšia množina kľúčov:
    time, latlng, distance, altitude, velocity_smooth, heartrate, cadence, watts, temp, grade_smooth, moving
    """
    filename = f"streams_{activity_id}.json"

    def _fetch():
        keys = [
            "time",
            "latlng",
            "distance",
            "altitude",
            "velocity_smooth",
            "heartrate",
            "cadence",
            "watts",
            "temp",
            "grade_smooth",
            "moving",
        ]
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}/streams",
            headers=_auth_headers(token),
            params={"keys": ",".join(keys), "key_by_type": "true"},
            timeout=90,
        )

    return _maybe_load_or_cache(filename, _fetch)
