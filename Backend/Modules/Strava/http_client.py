# Modules/Strava/http_client.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Mapping

import time
import requests

from Configs.config import STRAVA_BASE


@dataclass
class StravaRateLimitState:
    short_limit: int = 0
    short_usage: int = 0
    long_limit: int = 0
    long_usage: int = 0
    reset_at_epoch: Optional[int] = None


class StravaHTTPClient:
    """
    HTTP wrapper pre Stravu:

    - drží base URL,
    - pridáva Authorization header,
    - loguje X-RateLimit-* hlavičky,
    - jednoduché spomalenie, keď sa blížiš k limitu.
    """

    def __init__(self, access_token: str, base_url: Optional[str] = None) -> None:
        if not access_token:
            raise ValueError("StravaHTTPClient requires non-empty access_token")

        self.base_url = (base_url or STRAVA_BASE).rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {access_token}"})
        self._rate = StravaRateLimitState()

    # --------------------- interné helpery ---------------------

    def _update_rate_limit_from_headers(self, headers: Mapping[str, Any]) -> None:
        """
        Strava hlavičky:
          X-RateLimit-Limit: "600,30000"
          X-RateLimit-Usage: "123,4567"
        """
        limit_raw = headers.get("X-RateLimit-Limit")
        usage_raw = headers.get("X-RateLimit-Usage")

        try:
            if isinstance(limit_raw, str):
                short_l, long_l = [int(x) for x in limit_raw.split(",")]
                self._rate.short_limit = short_l
                self._rate.long_limit = long_l
            if isinstance(usage_raw, str):
                short_u, long_u = [int(x) for x in usage_raw.split(",")]
                self._rate.short_usage = short_u
                self._rate.long_usage = long_u
        except Exception:
            # keď formát nesedí, nepanikár; len to preskoč
            pass

        print(
            "[STRAVA][rate]",
            f"short {self._rate.short_usage}/{self._rate.short_limit},",
            f"long {self._rate.long_usage}/{self._rate.long_limit}",
            flush=True,
        )

    def _maybe_sleep_for_rate_limit(self) -> None:
        """
        Jednoduchý throttling:
        - ak short_usage > 90 % short_limit → krátky sleep.
        """
        if self._rate.short_limit <= 0:
            return

        ratio = self._rate.short_usage / float(self._rate.short_limit)
        if ratio >= 0.9:
            sleep_s = 5
            print(
                f"[STRAVA][rate] close to short-window limit, sleeping {sleep_s}s",
                flush=True,
            )
            time.sleep(sleep_s)

    def _build_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.base_url}/{path.lstrip('/')}"

    # --------------------- verejné metódy ---------------------

    def get(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> requests.Response:
        self._maybe_sleep_for_rate_limit()
        url = self._build_url(path)
        resp = self._session.get(url, params=params, timeout=timeout)
        self._update_rate_limit_from_headers(resp.headers)
        resp.raise_for_status()
        return resp