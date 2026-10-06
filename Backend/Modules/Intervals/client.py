# Modules/Intervals/client.py
from __future__ import annotations

from typing import Any, Dict, List

import requests

from Modules.Intervals.config import INTERVALS_BASE

TIMEOUT_S = 20


def fetch_wellness(
    athlete_id: str,
    api_key: str,
    oldest_iso: str,
    newest_iso: str,
) -> List[Dict[str, Any]]:
    """
    GET /athlete/{id}/wellness?oldest=&newest=
    Auth: Basic, username "API_KEY", heslo = osobný API kľúč.
    Vracia zoznam dní, `id` je dátum "YYYY-MM-DD".
    """
    url = f"{INTERVALS_BASE}/athlete/{athlete_id}/wellness"
    res = requests.get(
        url,
        params={"oldest": oldest_iso, "newest": newest_iso},
        auth=("API_KEY", api_key),
        timeout=TIMEOUT_S,
    )
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []


def upsert_events(athlete_id: str, api_key: str, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    POST /athlete/{id}/events/bulk?upsert=true – udalosť s rovnakým
    external_id sa aktualizuje, nová sa vytvorí.
    """
    url = f"{INTERVALS_BASE}/athlete/{athlete_id}/events/bulk"
    res = requests.post(
        url,
        params={"upsert": "true"},
        json=events,
        auth=("API_KEY", api_key),
        timeout=TIMEOUT_S,
    )
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []


def list_events(athlete_id: str, api_key: str, oldest_iso: str, newest_iso: str) -> List[Dict[str, Any]]:
    """GET /athlete/{id}/events?oldest=&newest= – plánované tréningy v kalendári."""
    url = f"{INTERVALS_BASE}/athlete/{athlete_id}/events"
    res = requests.get(
        url,
        params={"oldest": oldest_iso, "newest": newest_iso, "category": "WORKOUT"},
        auth=("API_KEY", api_key),
        timeout=TIMEOUT_S,
    )
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []


def delete_event(athlete_id: str, api_key: str, event_id: Any) -> None:
    """DELETE /athlete/{id}/events/{eventId}"""
    url = f"{INTERVALS_BASE}/athlete/{athlete_id}/events/{event_id}"
    res = requests.delete(url, auth=("API_KEY", api_key), timeout=TIMEOUT_S)
    # už zmazané (404) nie je chyba
    if res.status_code != 404:
        res.raise_for_status()
