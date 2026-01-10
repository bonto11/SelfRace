from __future__ import annotations

from typing import Any, Dict, List

import requests

from Modules.Strava.auth import get_access_token
from Configs.config import STRAVA_BASE


class StravaActivitiesClient:
    """
    Klient na čítanie Strava aktivít (summary + detail + laps + streams).

    - drží jednu requests.Session s Authorization headerom
    - rate-limit rieši volajúci (time.sleep v servicách)

    Dôležité:
      - fetch_activity_detail() vracia celý DetailedActivity objekt,
        teda aj:
          - workout_type
          - map.summary_polyline
          - map.polyline
    """

    def __init__(self) -> None:
        token = get_access_token()
        if not token:
            raise RuntimeError(
                "Chýba Strava access token. Spusť autorizáciu a /exchange_token."
            )
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {token}"})
        self._session = s

    # ------------------------------------------------------------------
    # /athlete/activities
    # ------------------------------------------------------------------
    def fetch_athlete_activities_page(
        self,
        *,
        after_epoch: int,
        page: int,
        per_page: int = 100,
        timeout: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Načíta jednu stránku /athlete/activities.
        """
        r = self._session.get(
            f"{STRAVA_BASE}/athlete/activities",
            params={
                "after": int(after_epoch),
                "per_page": int(per_page),
                "page": int(page),
            },
            timeout=timeout,
        )
        r.raise_for_status()
        data = r.json() or []
        if not isinstance(data, list):
            return []
        return data

    # ------------------------------------------------------------------
    # /activities/{id}
    # ------------------------------------------------------------------
    def fetch_activity_detail(
        self,
        activity_id: int,
        *,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """
        Detail jednej aktivity: /activities/{id}

        Vracia DetailedActivity JSON, vrátane:
          - workout_type
          - map.summary_polyline
          - map.polyline
        """
        r = self._session.get(
            f"{STRAVA_BASE}/activities/{int(activity_id)}",
            timeout=timeout,
        )
        r.raise_for_status()
        data = r.json() or {}
        if not isinstance(data, dict):
            return {}
        return data

    # ------------------------------------------------------------------
    # /activities/{id}/laps
    # ------------------------------------------------------------------
    def fetch_activity_laps(
        self,
        activity_id: int,
        *,
        timeout: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Laps pre jednu aktivitu: /activities/{id}/laps
        """
        r = self._session.get(
            f"{STRAVA_BASE}/activities/{int(activity_id)}/laps",
            timeout=timeout,
        )
        r.raise_for_status()
        data = r.json() or []
        if not isinstance(data, list):
            return []
        return data

    # ------------------------------------------------------------------
    # /activities/{id}/streams
    # ------------------------------------------------------------------
    def fetch_activity_streams(
        self,
        activity_id: int,
        *,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """
        Streams pre jednu aktivitu: /activities/{id}/streams (key_by_type=true).

        Vracia raw JSON dict:
        {
          "time": {"data": [...]},
          "heartrate": {"data": [...]},
          "distance": {"data": [...]},
          "altitude": {"data": [...]},
          "velocity_smooth": {"data": [...]},
          "cadence": {"data": [...]},
          "watts": {"data": [...]},
          "latlng": {"data": [...]},
          "grade_smooth": {"data": [...]},
          "temp": {"data": [...]},
          "moving": {"data": [...]},
          ...
        }
        """
        r = self._session.get(
            f"{STRAVA_BASE}/activities/{int(activity_id)}/streams",
            params={
                "keys": (
                    "time,heartrate,distance,altitude,"
                    "velocity_smooth,cadence,watts,latlng,"
                    "grade_smooth,temp,moving"
                ),
                "key_by_type": "true",
            },
            timeout=timeout,
        )
        # 403/404 → necháme raise_for_status alebo si to rieši volajúci try/except
        if r.status_code in (403, 404):
            r.raise_for_status()
        j = r.json() or {}
        if not isinstance(j, dict):
            return {}
        return j