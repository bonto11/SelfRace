# Modules/Intervals/client.py
from __future__ import annotations

from typing import Any, Dict, List

import requests

from Modules.Intervals.config import INTERVALS_BASE, IntervalsAccount

TIMEOUT_S = 20


def fetch_wellness(
    account: IntervalsAccount,
    oldest_iso: str,
    newest_iso: str,
) -> List[Dict[str, Any]]:
    """
    GET /athlete/{id}/wellness?oldest=&newest=
    Auth: Basic, username "API_KEY", heslo = osobný API kľúč.
    Vracia zoznam dní, `id` je dátum "YYYY-MM-DD".
    """
    url = f"{INTERVALS_BASE}/athlete/{account.athlete_id}/wellness"
    res = requests.get(
        url,
        params={"oldest": oldest_iso, "newest": newest_iso},
        auth=("API_KEY", account.api_key),
        timeout=TIMEOUT_S,
    )
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []
