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
from Modules.Supabase.auth import AuthCtx

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
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Raw zoznam riadkov z KV tabuľky (key/value/updated_at)."""
    
    return db_get_prefs_all(ctx=ctx,user_id=user_id )


def service_get_user_pref(
    user_id: int,
    key: str,
    ctx: AuthCtx,
) -> Optional[Any]:
    
    row = db_get_pref_single(ctx=ctx,user_id=user_id, key=key)
    return row.get("value") if row else None


def service_save_user_pref(
    user_id: int,
    key: str,
    value: Any,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    
    return db_upsert_pref_single(ctx=ctx,user_id=user_id, key=key, value=value)


def service_save_user_prefs_bulk(
    user_id: int,
    kv: Dict[str, Any],
    ctx: AuthCtx,
) -> int:
    
    return db_upsert_many(ctx=ctx, user_id=user_id, kv=kv)


def service_delete_user_pref(
    user_id: int,
    key: str,
    ctx: AuthCtx,
) -> int:

    return db_delete_pref_single(ctx=ctx,user_id=user_id, key=key, )


# ---------- COACH prefs / AI analýza ----------

def service_load_coach_prefs_for_analysis(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vytiahne celé coach prefs (JSON) z KV tabuľky a vráti ako dict.

    Režimy:
      - service=False: RLS, require_jwt + RLS klient.
      - service=True:  service klient, user_jwt sa len forwarduje (typicky None).
    """

    row = db_get_pref_single(
        user_id,
        COACH_PREFS_KEY,
        ctx=ctx,
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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží celé coach prefs (JSON) pod key="coach.prefs".
    - FE: service=False + JWT
    - worker: service=True (bez JWT), ak to budeš chcieť niekedy ukladať aj z workeru
    """

    return db_upsert_pref_single(
        user_id,
        COACH_PREFS_KEY,
        prefs,
        ctx=ctx,
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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Načíta user nastavenia spod key="user.settings" a doplní defaulty.

    - service=False → FE/RLS (JWT required)
    - service=True  → worker/webhook (JWT not required)
    """

    row = db_get_pref_single(
        user_id,
        USER_SETTINGS_KEY,
        ctx=ctx,
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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží user nastavenia pod key="user.settings".
    """

    merged = DEFAULT_USER_SETTINGS.copy()
    merged.update(settings or {})

    return db_upsert_pref_single(
        user_id,
        USER_SETTINGS_KEY,
        merged,
        ctx=ctx,
    )


def service_get_user_language(
    user_id: int,
    ctx: AuthCtx,
) -> str:
    settings = service_load_user_settings(user_id=user_id, ctx=ctx)
    lang = settings.get("language") or "sk"
    return lang.strip().lower() if isinstance(lang, str) and lang.strip() else "sk"


def service_get_user_timezone(
    user_id: int,
    ctx: AuthCtx,
) -> str:
    settings = service_load_user_settings(ctx=ctx,user_id=user_id)
    tz = settings.get("timezone") or "Europe/Bratislava"
    return tz.strip() if isinstance(tz, str) and tz.strip() else "Europe/Bratislava"