from typing import List, Optional, Any
import requests

from backend.Modules.config import STRAVA_BASE
from .auth import _auth_headers
from .client import _maybe_sleep_to_respect_limits
from .cache import _maybe_load_or_cache


def get_activity_zones(
    activity_id: int, token: Optional[str] = None
) -> Optional[List[Any]]:
    """
    Zóny (HR/power). Môže vrátiť 402 Payment Required pri ne-prémiu.
    """
    filename = f"zones_{activity_id}.json"

    def _fetch():
        try:
            resp = requests.get(
                f"{STRAVA_BASE}/activities/{activity_id}/zones",
                headers=_auth_headers(token),
                timeout=30,
            )
            if resp.status_code == 402:
                return None
            resp.raise_for_status()
            _maybe_sleep_to_respect_limits(resp)
            return resp.json()
        except requests.HTTPError as e:
            raise

    return _maybe_load_or_cache(filename, _fetch)
