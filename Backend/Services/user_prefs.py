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

# nový kľúč pre všeobecné user nastavenia (jazyk, timezone, jednotky…)
USER_SETTINGS_KEY = "user.settings"

# default hodnoty, keď ešte user nič nemá uložené
DEFAULT_USER_SETTINGS: Dict[str, Any] = {
    "language": "sk",                # výstup AI + neskôr UI jazyk
    "timezone": "Europe/Bratislava", # IANA timezone string
    "time_format_24h": True,
    "date_format": "yyyy-MM-dd",
    # do budúcna môžeš pridať:
    # "units": "metric" / "imperial",
    # "week_start": "Mon",
}


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


# ---------- USER SETTINGS (jazyk, timezone, …) ----------


def _parse_json_value(val: Any) -> Dict[str, Any]:
    """Interný helper na rozumné rozparsovanie JSON/string/dict hodnoty."""
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def service_load_user_settings(user_id: int) -> Dict[str, Any]:
    """
    Načíta user nastavenia spod key="user.settings" a doplní defaulty.

    Výsledok typicky:
      {
        "language": "sk",
        "timezone": "Europe/Bratislava",
        "time_format_24h": true,
        "date_format": "yyyy-MM-dd",
        ...
      }
    """
    row = db_get_pref_single(user_id, USER_SETTINGS_KEY)
    if not row:
        # nič v DB -> vráť čisté defaulty
        return DEFAULT_USER_SETTINGS.copy()

    raw_val = row.get("value")
    parsed = _parse_json_value(raw_val)

    # merge: DB má prioritu, ale všetky default keys budú vždy prítomné
    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(parsed or {})
    return merged


def service_save_user_settings(user_id: int, settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Uloží user nastavenia pod key="user.settings".
    Nepokúša sa validovať – to si rieš na úrovni FE alebo separátnym validatorom.
    """
    # merge s defaultmi, aby sme mali vždy konzistentný shape
    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(settings or {})
    return db_upsert_pref_single(user_id, USER_SETTINGS_KEY, merged)


def service_get_user_language(user_id: int) -> str:
    """
    Convenience helper – vráti jazyk usera (napr. 'sk' alebo 'en').
    """
    settings = service_load_user_settings(user_id)
    lang = settings.get("language") or "sk"
    # pre istotu orez + lower
    if isinstance(lang, str):
        return lang.strip().lower() or "sk"
    return "sk"


def service_get_user_timezone(user_id: int) -> str:
    """
    Convenience helper – vráti timezone usera (IANA string).
    """
    settings = service_load_user_settings(user_id)
    tz = settings.get("timezone") or "Europe/Bratislava"
    if isinstance(tz, str):
        return tz.strip() or "Europe/Bratislava"
    return "Europe/Bratislava"