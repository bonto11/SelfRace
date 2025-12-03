# Services/user_prefs.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from Routes_DB.user_prefs import (
    db_get_prefs_all,
    db_get_pref_single,
    db_upsert_pref_single,
    db_upsert_many,
    db_delete_pref_single,
)

# kľúč, pod ktorým si ukladáš celé coach prefs (JSON) do KV tabuľky
COACH_PREFS_KEY = "coach.prefs"


# ---------- generické helpery nad KV prefs ----------


def service_get_user_prefs_list(user_id: int) -> List[Dict[str, Any]]:
    """Raw zoznam riadkov z KV tabuľky (key/value/updated_at)."""
    return db_get_prefs_all(user_id)


def service_get_user_prefs_map(user_id: int) -> Dict[str, Any]:
    """Mapovanie {key: value} pre všetky prefs daného usera."""
    rows = db_get_prefs_all(user_id)
    return {str(r["key"]): r.get("value") for r in rows}


def service_get_user_pref(user_id: int, key: str) -> Optional[Any]:
    row = db_get_pref_single(user_id, key)
    return row.get("value") if row else None


def service_save_user_pref(user_id: int, key: str, value: Any) -> Dict[str, Any]:
    return db_upsert_pref_single(user_id, key, value)


def service_save_user_prefs_bulk(user_id: int, kv: Dict[str, Any]) -> int:
    return db_upsert_many(user_id, kv)


def service_delete_user_pref(user_id: int, key: str) -> int:
    return db_delete_pref_single(user_id, key)


# ---------- špecificky pre COACH prefs / AI analýzu ----------


def service_load_coach_prefs_for_analysis(user_id: int) -> Dict[str, Any]:
    """
    Vytiahne celé coach prefs (JSON) z KV tabuľky a vráti ako dict.

    Očakávaný obsah value pri key="coach.prefs":
      {
        "schema_version": 1,
        "weeks": 4,
        "goal_kind": "improve_overall",
        "plan_start_date": "2025-12-04",
        "primary_sports": [...],
        "main_sport": "run",
        "secondary_mix": [...],
        "targets": {...},
        "rules": {...},
        "externals": [...],
        "blocks": {...},
        "strength_settings": {...},
        "coach_voice": "...",
        "coach_tone": {...},
        ...
      }
    """
    row = db_get_pref_single(user_id, COACH_PREFS_KEY)
    if not row:
        return {}

    val = row.get("value")
    raw: Any

    if isinstance(val, dict):
        raw = val
    elif isinstance(val, str):
        try:
            raw = json.loads(val)
        except Exception:
            raw = {}
    else:
        raw = {}

    return raw if isinstance(raw, dict) else {}


def service_save_coach_prefs(user_id: int, prefs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Uloží celé coach prefs (JSON) pod key="coach.prefs".
    Použiješ ju napr. pri FE formulári coach preferences.
    """
    return db_upsert_pref_single(user_id, COACH_PREFS_KEY, prefs)