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
from Services.users import require_jwt

# kľúč, pod ktorým si ukladáš celé coach prefs (JSON) do KV tabuľky
COACH_PREFS_KEY = "coach.prefs"

# nový kľúč pre všeobecné user nastavenia (jazyk, timezone, jednotky…)
USER_SETTINGS_KEY = "user.settings"

# default hodnoty, keď ešte user nič nemá uložené
DEFAULT_USER_SETTINGS: Dict[str, Any] = {
    "language": "sk",  # výstup AI + neskôr UI jazyk
    "timezone": "Europe/Bratislava",  # IANA timezone string
    "time_format_24h": True,
    "date_format": "yyyy-MM-dd",
}


# ---------- generické helpery nad KV prefs ----------

def service_get_user_prefs_list(
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """Raw zoznam riadkov z KV tabuľky (key/value/updated_at)."""
    jwt = user_jwt if service else require_jwt(user_jwt)
    return db_get_prefs_all(user_id, user_jwt=jwt, service=service)


def service_get_user_prefs_map(
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """Mapovanie {key: value} pre všetky prefs daného usera."""
    jwt = user_jwt if service else require_jwt(user_jwt)
    rows = db_get_prefs_all(user_id, user_jwt=jwt, service=service)
    return {str(r["key"]): r.get("value") for r in (rows or [])}


def service_get_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Any]:
    jwt = user_jwt if service else require_jwt(user_jwt)
    row = db_get_pref_single(user_id, key, user_jwt=jwt, service=service)
    return row.get("value") if row else None


def service_save_user_pref(
    user_id: int,
    key: str,
    value: Any,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    jwt = user_jwt if service else require_jwt(user_jwt)
    return db_upsert_pref_single(user_id, key, value, user_jwt=jwt, service=service)


def service_save_user_prefs_bulk(
    user_id: int,
    kv: Dict[str, Any],
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    jwt = user_jwt if service else require_jwt(user_jwt)
    return db_upsert_many(user_id, kv, user_jwt=jwt, service=service)


def service_delete_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    jwt = user_jwt if service else require_jwt(user_jwt)
    return db_delete_pref_single(user_id, key, user_jwt=jwt, service=service)


# ---------- COACH prefs / AI analýza ----------

def service_load_coach_prefs_for_analysis(
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vytiahne celé coach prefs (JSON) z KV tabuľky a vráti ako dict.

    Režimy:
      - service=False: RLS, require_jwt + RLS klient.
      - service=True:  service klient, user_jwt sa len forwarduje (typicky None).
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    row = db_get_pref_single(
        user_id,
        COACH_PREFS_KEY,
        user_jwt=jwt,
        service=service,
    )
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
    service: bool = False,
) -> Dict[str, Any]:
    """
    Uloží celé coach prefs (JSON) pod key="coach.prefs".
    - FE: service=False + JWT
    - worker: service=True (bez JWT), ak to budeš chcieť niekedy ukladať aj z workeru
    """
    jwt = user_jwt if service else require_jwt(user_jwt)
    return db_upsert_pref_single(
        user_id,
        COACH_PREFS_KEY,
        prefs,
        user_jwt=jwt,
        service=service,
    )


# ---------- USER SETTINGS (jazyk, timezone, …) ----------

def _parse_json_value(val: Any) -> Dict[str, Any]:
    """Rozumné rozparsovanie JSON/string/dict hodnoty."""
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
    service: bool = False,
) -> Dict[str, Any]:
    """
    Načíta user nastavenia spod key="user.settings" a doplní defaulty.

    - service=False → FE/RLS (JWT required)
    - service=True  → worker/webhook (JWT not required)
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    row = db_get_pref_single(
        user_id,
        USER_SETTINGS_KEY,
        user_jwt=jwt,
        service=service,
    )
    if not row:
        return DEFAULT_USER_SETTINGS.copy()

    parsed = _parse_json_value(row.get("value"))

    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(parsed or {})
    return merged


def service_save_user_settings(
    user_id: int,
    settings: Dict[str, Any],
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Uloží user nastavenia pod key="user.settings".
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(settings or {})

    return db_upsert_pref_single(
        user_id,
        USER_SETTINGS_KEY,
        merged,
        user_jwt=jwt,
        service=service,
    )


def service_get_user_language(
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> str:
    settings = service_load_user_settings(user_id, user_jwt=user_jwt, service=service)
    lang = settings.get("language") or "sk"
    return lang.strip().lower() if isinstance(lang, str) and lang.strip() else "sk"


def service_get_user_timezone(
    user_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> str:
    settings = service_load_user_settings(user_id, user_jwt=user_jwt, service=service)
    tz = settings.get("timezone") or "Europe/Bratislava"
    return tz.strip() if isinstance(tz, str) and tz.strip() else "Europe/Bratislava"