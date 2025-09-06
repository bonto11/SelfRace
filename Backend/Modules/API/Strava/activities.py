from typing import List, Dict, Any, Optional

from backend.Modules.config import STRAVA_BASE
from .auth import get_access_token, _auth_headers, authorize_user
from .client import _request_json
from .cache import _maybe_load_or_cache


def get_activities(
    token: Optional[str] = None, after_timestamp: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Zoznam aktivít prihláseného atléta.
    after_timestamp = epoch sekundy (UTC). Ak je zadané, Strava vráti len aktivity po tomto čase.
    """
    filename = f"activities_list_after_{after_timestamp or 0}.json"

    def _fetch():
        tok = token or get_access_token()
        if not tok:
            print("🔑 Nie si prihlásený, spúšťam autorizáciu...")
            authorize_user()
            tok = get_access_token()
            if not tok:
                raise RuntimeError("❌ Nepodarilo sa získať access token.")

        all_activities: List[Dict[str, Any]] = []
        page = 1
        per_page = 200

        while True:
            params = {"per_page": per_page, "page": page}
            if after_timestamp:
                params["after"] = int(after_timestamp)

            activities = _request_json(
                "GET",
                f"{STRAVA_BASE}/athlete/activities",
                headers=_auth_headers(tok),
                params=params,
                timeout=60,
            )

            if not activities:
                break

            all_activities.extend(activities)
            if len(activities) < per_page:
                break
            page += 1

        return all_activities

    return _maybe_load_or_cache(filename, _fetch)


def get_activity_data(activity_id: int, token: Optional[str] = None) -> Dict[str, Any]:
    filename = f"activity_{activity_id}.json"

    def _fetch():
        tok = token or get_access_token()
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}",
            headers=_auth_headers(tok),
            timeout=30,
        )

    return _maybe_load_or_cache(filename, _fetch)


def get_activity_full(
    activity_id: int, include_all_efforts: bool = True, token: Optional[str] = None
) -> Dict[str, Any]:
    filename = f"activity_full_{activity_id}.json"

    def _fetch():
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}",
            headers=_auth_headers(token),
            params={"include_all_efforts": "true" if include_all_efforts else "false"},
            timeout=60,
        )

    return _maybe_load_or_cache(filename, _fetch)
