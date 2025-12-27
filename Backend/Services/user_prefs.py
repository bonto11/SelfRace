# Services/user_prefs.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

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


def _require_jwt(user_jwt: Optional[str]) -> str:
    """
    Všetky user_prefs operácie chceme cez RLS → JWT je povinné.
    """
    if not user_jwt:
        raise HTTPException(status_code=401, detail="Missing Authorization JWT")
    return user_jwt


# ---------- generické helpery nad KV prefs ----------


def service_get_user_prefs_list(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Raw zoznam riadkov z KV tabuľky (key/value/updated_at)."""
    user_jwt = _require_jwt(user_jwt)
    return db_get_prefs_all(user_id, user_jwt=user_jwt)


def service_get_user_prefs_map(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """Mapovanie {key: value} pre všetky prefs daného usera."""
    user_jwt = _require_jwt(user_jwt)
    rows = db_get_prefs_all(user_id, user_jwt=user_jwt)
    return {str(r["key"]): r.get("value") for r in rows}


def service_get_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = None,
) -> Optional[Any]:
    user_jwt = _require_jwt(user_jwt)
    row = db_get_pref_single(user_id, key, user_jwt=user_jwt)
    return row.get("value") if row else None


def service_save_user_pref(
    user_id: int,
    key: str,
    value: Any,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    user_jwt = _require_jwt(user_jwt)
    return db_upsert_pref_single(user_id, key, value, user_jwt=user_jwt)


def service_save_user_prefs_bulk(
    user_id: int,
    kv: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> int:
    user_jwt = _require_jwt(user_jwt)
    return db_upsert_many(user_id, kv, user_jwt=user_jwt)


def service_delete_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = None,
) -> int:
    user_jwt = _require_jwt(user_jwt)
    return db_delete_pref_single(user_id, key, user_jwt=user_jwt)


# ---------- špecificky pre COACH prefs / AI analýzu ----------


def service_load_coach_prefs_for_analysis(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Vytiahne celé coach prefs (JSON) z KV tabuľky a vráti ako dict.
    """
    user_jwt = _require_jwt(user_jwt)

    row = db_get_pref_single(user_id, COACH_PREFS_KEY, user_jwt=user_jwt)
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


def service_save_coach_prefs(
    user_id: int,
    prefs: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Uloží celé coach prefs (JSON) pod key="coach.prefs".
    """
    user_jwt = _require_jwt(user_jwt)
    return db_upsert_pref_single(user_id, COACH_PREFS_KEY, prefs, user_jwt=user_jwt)


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


def service_load_user_settings(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Načíta user nastavenia spod key="user.settings" a doplní defaulty.
    """
    user_jwt = _require_jwt(user_jwt)

    row = db_get_pref_single(user_id, USER_SETTINGS_KEY, user_jwt=user_jwt)
    if not row:
        # nič v DB -> vráť čisté defaulty
        return DEFAULT_USER_SETTINGS.copy()

    raw_val = row.get("value")
    parsed = _parse_json_value(raw_val)

    # merge: DB má prioritu, ale všetky default keys budú vždy prítomné
    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(parsed or {})
    return merged


def service_save_user_settings(
    user_id: int,
    settings: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Uloží user nastavenia pod key="user.settings".
    """
    user_jwt = _require_jwt(user_jwt)

    # merge s defaultmi, aby sme mali vždy konzistentný shape
    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(settings or {})
    return db_upsert_pref_single(
        user_id,
        USER_SETTINGS_KEY,
        merged,
        user_jwt=user_jwt,
    )


def service_get_user_language(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> str:
    """
    Convenience helper – vráti jazyk usera (napr. 'sk' alebo 'en').
    """
    settings = service_load_user_settings(user_id, user_jwt=user_jwt)
    lang = settings.get("language") or "sk"
    if isinstance(lang, str):
        return lang.strip().lower() or "sk"
    return "sk"


def service_get_user_timezone(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> str:
    """
    Convenience helper – vráti timezone usera (IANA string).
    """
    settings = service_load_user_settings(user_id, user_jwt=user_jwt)
    tz = settings.get("timezone") or "Europe/Bratislava"
    if isinstance(tz, str):
        return tz.strip() or "Europe/Bratislava"
    return "Europe/Bratislava"