import time
import requests
from typing import Tuple, Optional, Dict, Any

from backend.Modules.config import REQUEST_DELAY_SECS


def _parse_rate_headers(resp) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Vracia ((used_short, used_long), (limit_short, limit_long))
    Strava hlavičky:
      X-RateLimit-Limit: "100,1000"
      X-RateLimit-Usage: "12,123"
    """
    limit = resp.headers.get("X-RateLimit-Limit", "100,1000")
    usage = resp.headers.get("X-RateLimit-Usage", "0,0")
    ls = tuple(int(x) for x in limit.split(",")) if limit else (100, 1000)
    us = tuple(int(x) for x in usage.split(",")) if usage else (0, 0)
    if len(ls) != 2:
        ls = (100, 1000)
    if len(us) != 2:
        us = (0, 0)
    return (us[0], us[1]), (ls[0], ls[1])


def _maybe_sleep_to_respect_limits(resp):
    (used_s, _used_l), (lim_s, _lim_l) = _parse_rate_headers(resp)
    try:
        if lim_s > 0 and (used_s / lim_s) >= 0.9:
            time.sleep(2.0)
    except Exception:
        pass


def _request_json(method: str, url: str, *, timeout: float = 60, **kwargs) -> Any:
    """
    Jednotné volanie requests s:
      - raise_for_status
      - jemným rešpektovaním rate limitov (spomalenie pri 90% krátkeho okna)
      - exponenciálnym backoffom pri 429
      - dobrovoľným globálnym delay (REQUEST_DELAY_SECS)
    """
    backoff = 2.0
    for attempt in range(6):
        resp = requests.request(method, url, timeout=timeout, **kwargs)
        if resp.status_code == 429:
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
            continue
        resp.raise_for_status()
        _maybe_sleep_to_respect_limits(resp)
        if REQUEST_DELAY_SECS > 0:
            time.sleep(REQUEST_DELAY_SECS)
        return resp.json()
    # ak sme sa sem dostali, stále 429
    resp.raise_for_status()
