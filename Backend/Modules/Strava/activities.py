# Modules/Strava/activities.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Strava.http_client import StravaHTTPClient
from Configs.config import STRAVA_DEBUG_STREAMS

def _dbg_strava(*args: Any, **kwargs: Any) -> None:
    if STRAVA_DEBUG_STREAMS:
        print("[strava-streams]", *args, **kwargs, flush=True)


class StravaActivitiesClient:
    """
    Klient na čítanie Strava aktivít (summary + detail + laps + streams).

    PRODUKCIA:
      - vždy vytváraj cez access_token z tabuľky strava_accounts,
        napr. StravaActivitiesClient(access_token=token_from_db)

    ŽIADNY fallback na lokálne súbory / legacy auth.
    """

    def __init__(self, access_token: str) -> None:
        if not access_token:
            raise ValueError("StravaActivitiesClient requires non-empty access_token")

        self._http = StravaHTTPClient(access_token=access_token)

    # ------------------------------------------------------------------
    # /athlete/activities
    # ------------------------------------------------------------------
    def fetch_athlete_activities_page(
        self,
        *,
        after_epoch: int,
        page: int,
        per_page: int = 100,
        before_epoch: int, 
        timeout: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Načíta jednu stránku /athlete/activities.

        - after_epoch  → vracia aktivity po tomto čase (unix epoch seconds)
        - before_epoch → (optional) vracia len aktivity pred týmto časom
        """
        params: Dict[str, Any] = {
            "after": int(after_epoch),
            "before": int(before_epoch),
            "per_page": int(per_page),
            "page": int(page),
        }

        r = self._http.get(
            "/athlete/activities",
            params=params,
            timeout=timeout,
        )
        data = r.json() or []

        if not isinstance(data, list):
            return []
        return [dict(x) for x in data if isinstance(x, dict)]

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
        r = self._http.get(
            f"/activities/{int(activity_id)}",
            timeout=timeout,
        )
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
        r = self._http.get(
            f"/activities/{int(activity_id)}/laps",
            timeout=timeout,
        )
        data = r.json() or []
        
        if not isinstance(data, list):
            return []
        return [dict(x) for x in data if isinstance(x, dict)]

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
        r = self._http.get(
            f"/activities/{int(activity_id)}/streams",
            params={
                "keys": (
                    "time,heartrate,distance,altitude,"
                    "velocity_smooth,cadence,watts,"
                    "grade_smooth,temp,moving"
                ),
                "key_by_type": "true",
            },
            timeout=timeout,
        )

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