# Modules/Intervals/connect.py
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import requests

from DB.users import db_get_auth_uid
from Modules.Intervals.client import fetch_wellness
from Modules.Intervals.db import (
    db_intervals_delete,
    db_intervals_get_status_row,
    db_intervals_upsert,
)
from Modules.Intervals.sync import TZ, service_intervals_sync_user
from Modules.Supabase.auth import AuthCtx, service_ctx
from Modules.Supabase.client import get_service_client

# Po pripojení sa natiahne história, aby mal user hneď trendy a baseline.
INITIAL_SYNC_DAYS = 30

_ATHLETE_RE = re.compile(r"^i?(\d{1,12})$", re.IGNORECASE)


def is_owner(ctx: AuthCtx, user_id: int) -> bool:
    """
    JWT patrí userovi s týmto user_id?

    PREČO explicitná kontrola: intervals_accounts je len pre service role
    (drží API kľúč), takže tu RLS nič nechráni – bez kontroly by ktokoľvek
    prihlásený vedel prepísať alebo zmazať cudzie napojenie.
    """
    if not ctx.jwt:
        return False
    try:
        res = get_service_client().auth.get_user(ctx.jwt)
        auth_uid = str(getattr(getattr(res, "user", None), "id", "") or "")
        expected = db_get_auth_uid(int(user_id), ctx=service_ctx("intervals.is_owner"))
        return bool(auth_uid) and auth_uid == (expected or "")
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] owner check failed user={user_id}: {repr(e)}")
        return False


def _normalize_athlete_id(raw: str) -> Optional[str]:
    m = _ATHLETE_RE.match((raw or "").strip())
    return f"i{m.group(1)}" if m else None


def service_intervals_status(user_id: int) -> Dict[str, Any]:
    try:
        row = db_intervals_get_status_row(user_id)
    except Exception as e:  # noqa: BLE001
        # Chýbajúca tabuľka (pred migráciou) = integrácia vypnutá, nie 500.
        print(f"[INTERVALS] status failed user={user_id}: {repr(e)}")
        row = None

    if not row or not row.get("enabled"):
        return {"connected": False}
    return {
        "connected": True,
        "athlete_id": row.get("athlete_id"),
        "last_synced_at": row.get("last_synced_at"),
        "has_error": bool(row.get("last_error")),
    }


def service_intervals_connect(
    user_id: int,
    athlete_id_raw: str,
    api_key_raw: str,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    athlete_id = _normalize_athlete_id(athlete_id_raw)
    api_key = (api_key_raw or "").strip()
    if not athlete_id:
        return {"ok": False, "code": "intervals_invalid_athlete_id"}
    if len(api_key) < 8:
        return {"ok": False, "code": "intervals_invalid_api_key"}

    # Overenie údajov skúšobným dopytom ešte pred uložením – zlý kľúč by
    # inak ticho zlyhával pri každom cron behu.
    today = datetime.now(TZ).date()
    try:
        fetch_wellness(athlete_id, api_key, (today - timedelta(days=1)).isoformat(), today.isoformat())
    except requests.HTTPError as e:
        status = getattr(e.response, "status_code", None)
        if status in (401, 403):
            return {"ok": False, "code": "intervals_invalid_api_key"}
        if status == 404:
            return {"ok": False, "code": "intervals_invalid_athlete_id"}
        print(f"[INTERVALS] connect check failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "intervals_fetch_failed"}
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] connect check failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "intervals_fetch_failed"}

    db_intervals_upsert(user_id, athlete_id, api_key)

    # Prvý sync je bonus – jeho zlyhanie nesmie zrušiť pripojenie.
    synced: Optional[Dict[str, Any]] = None
    try:
        synced = service_intervals_sync_user(user_id, INITIAL_SYNC_DAYS, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] initial sync failed user={user_id}: {repr(e)}")

    return {"ok": True, "athlete_id": athlete_id, "initial_sync": synced}


def service_intervals_disconnect(user_id: int) -> Dict[str, Any]:
    # Riadok sa maže celý (aj s API kľúčom) – sľubuje to privacy policy.
    # Už načítané hodnoty v users_recovery ostávajú, sú to záznamy usera.
    db_intervals_delete(user_id)
    return {"ok": True}
