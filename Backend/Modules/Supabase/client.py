# Modules/Supabase/client.py
from __future__ import annotations

from typing import Optional

from supabase import create_client

from Configs.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY
from Modules.Supabase.auth import AuthCtx


_service_client = None  # lazy init, shared in-process


def get_service_client():
    global _service_client
    if _service_client is None:
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    return _service_client


def get_user_client(user_jwt: str):
    if not user_jwt:
        raise RuntimeError("get_user_client() requires non-empty user_jwt")

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(user_jwt)
    return client


def get_sb(ctx: AuthCtx, *, caller: str = "db"):
    """
    Jediný entrypoint pre DB.
    - ctx.mode == "user"     -> RLS client (ANON + JWT)
    - ctx.mode == "internal" -> service role client
    """
    if ctx.mode == "internal":
        return get_service_client()

    if ctx.mode == "user":
        if not ctx.jwt:
            raise RuntimeError(f"{caller}: ctx.mode='user' but ctx.jwt is empty")
        return get_user_client(ctx.jwt)

    raise RuntimeError(f"{caller}: invalid ctx.mode={ctx.mode}")