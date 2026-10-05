# Modules/Supabase/client.py
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any, Optional

from supabase import create_client

from Configs.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY
from Modules.Supabase.auth import AuthCtx


_service_client = None  # lazy init, shared in-process


def get_service_client():
    global _service_client
    if _service_client is None:
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    return _service_client


# Cache RLS klientov podľa JWT.
#
# PREČO: create_client() pri každom DB volaní = nový httpx klient = nové
# TCP + TLS spojenie na Supabase, čo je pri každom volaní +100-300 ms. Jeden
# request z FE robí často viac DB volaní a pri štarte appky ide naraz veľa
# requestov. Klient je viazaný na jeden JWT (Authorization je na jeho
# postgrest session), takže dáta iného usera cez neho ísť nemôžu. Zdieľaný
# httpx klient pre všetkých by NEBOL bezpečný - postgrest mu prepisuje
# hlavičky. httpx.Client je thread-safe (rovnako ako zdieľaný service klient).
_USER_CLIENT_TTL_S = 15 * 60
_USER_CLIENT_MAX = 256

_user_clients: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
_user_clients_lock = threading.Lock()


def get_user_client(user_jwt: str):
    if not user_jwt:
        raise RuntimeError("get_user_client() requires non-empty user_jwt")

    now = time.monotonic()
    with _user_clients_lock:
        hit = _user_clients.get(user_jwt)
        if hit is not None:
            created_at, cached = hit
            if now - created_at < _USER_CLIENT_TTL_S:
                _user_clients.move_to_end(user_jwt)
                return cached
            _user_clients.pop(user_jwt, None)

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(user_jwt)

    with _user_clients_lock:
        _user_clients[user_jwt] = (now, client)
        _user_clients.move_to_end(user_jwt)
        # najstaršie vyhodíme - nezatvárame ich, môže ich ešte používať
        # bežiaci request; spojenie zatvorí GC
        while len(_user_clients) > _USER_CLIENT_MAX:
            _user_clients.popitem(last=False)

    return client


def get_sb(ctx: AuthCtx, *, caller: str = "db"):
    """
    Jediný entrypoint pre DB.

    - ctx.mode == "user"     -> RLS client (ANON + JWT)
    - ctx.mode == "internal" -> service role client
    """
    mode = str(getattr(ctx, "mode", "") or "").strip()

    if mode == "internal":
        # internal nesmie niesť jwt (nech je to čisté a jednoznačné)
        if getattr(ctx, "jwt", None):
            raise RuntimeError(f"{caller}: ctx.mode='internal' must not include jwt (ctx.caller={ctx.caller})")
        return get_service_client()

    if mode == "user":
        jwt = str(getattr(ctx, "jwt", "") or "").strip()
        if not jwt:
            raise RuntimeError(f"{caller}: ctx.mode='user' but ctx.jwt is empty (ctx.caller={ctx.caller})")
        return get_user_client(jwt)

    raise RuntimeError(f"{caller}: invalid ctx.mode={mode!r} (ctx.caller={getattr(ctx, 'caller', None)})")