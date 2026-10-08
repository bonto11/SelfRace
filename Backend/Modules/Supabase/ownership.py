# Modules/Supabase/ownership.py
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Optional

from DB.users import db_get_auth_uid, db_get_user_by_auth_uid
from Modules.Supabase.auth import AuthCtx, service_ctx
from Modules.Supabase.client import get_service_client


def is_owner(ctx: AuthCtx, user_id: int) -> bool:
    """
    Patrí JWT v ctx userovi s týmto user_id?

    PREČO explicitná kontrola: endpointy, ktoré pracujú cez service role
    (Strava účty, intervals_accounts), RLS nechráni – bez nej by ktokoľvek
    prihlásený vedel s cudzím user_id čítať alebo mazať cudzie napojenie.
    """
    if not ctx.is_user or not ctx.jwt:
        return False
    try:
        res = get_service_client().auth.get_user(ctx.jwt)
        auth_uid = str(getattr(getattr(res, "user", None), "id", "") or "")
        expected = db_get_auth_uid(int(user_id), ctx=service_ctx("ownership.is_owner"))
        return bool(auth_uid) and auth_uid == (expected or "")
    except Exception as e:  # noqa: BLE001
        print(f"[OWNERSHIP] check failed user={user_id}: {repr(e)}")
        return False


# Kto volá (users.id z JWT). PREČO cache: overenie JWT je volanie na Supabase
# Auth (100–300 ms). Živý tréner sa pýta pri každej úprave plánu a čítaní
# hodnotenia – bez cache by to spomalilo bežné akcie. JWT žije max ~1 h,
# 10 min cache je bezpečná (id usera sa pre daný token nemení).
_CALLER_TTL_S = 10 * 60
_CALLER_MAX = 512
_caller_cache: "OrderedDict[str, tuple[float, Optional[int]]]" = OrderedDict()
_caller_lock = threading.Lock()


def caller_user_id(ctx: AuthCtx) -> Optional[int]:
    """users.id prihláseného usera podľa JWT v ctx, alebo None."""
    if not ctx.is_user or not ctx.jwt:
        return None
    now = time.time()
    with _caller_lock:
        hit = _caller_cache.get(ctx.jwt)
        if hit and now - hit[0] < _CALLER_TTL_S:
            _caller_cache.move_to_end(ctx.jwt)
            return hit[1]
    try:
        res = get_service_client().auth.get_user(ctx.jwt)
        auth_uid = str(getattr(getattr(res, "user", None), "id", "") or "")
        row = (
            db_get_user_by_auth_uid(auth_uid, ctx=service_ctx("ownership.caller_user_id"))
            if auth_uid
            else None
        )
        uid = int(row["id"]) if row and row.get("id") is not None else None
    except Exception as e:  # noqa: BLE001
        print(f"[OWNERSHIP] caller resolve failed: {repr(e)}")
        return None  # chybu necachujeme – skúsi sa znova
    with _caller_lock:
        _caller_cache[ctx.jwt] = (now, uid)
        _caller_cache.move_to_end(ctx.jwt)
        while len(_caller_cache) > _CALLER_MAX:
            _caller_cache.popitem(last=False)
    return uid
