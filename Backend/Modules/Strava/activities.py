#Modules/Strava/activities
from __future__ import annotations

from typing import Any, Dict, List

import requests

from Modules.Strava.auth import get_access_token
from Configs.config import STRAVA_BASE

DEBUG_STRAVA_STREAMS = True


def _dbg_strava(*args: Any, **kwargs: Any) -> None:
    if DEBUG_STRAVA_STREAMS:
        print("[strava-streams]", *args, **kwargs, flush=True)


class StravaActivitiesClient:
    """
    Klient na čítanie Strava aktivít (summary + detail + laps + streams).
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
        if r.status_code in (403, 404):
            r.raise_for_status()
        j = r.json() or {}
        if not isinstance(j, dict):
            return {}

        _dbg_strava(
            f"fetch_activity_streams({activity_id}) "
            f"keys={sorted(list(j.keys()))}"
        )

        for key in [
            "time",
            "heartrate",
            "distance",
            "altitude",
            "velocity_smooth",
            "cadence",
            "watts",
            "grade_smooth",
            "temp",
        ]:
            val = (j.get(key) or {}).get("data") or []
            _dbg_strava(f"  {key}: len={len(val)}")

        return j