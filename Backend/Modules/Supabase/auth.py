# Modules/Supabase/auth.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request

from Configs.config import INTERNAL_SERVICE_SECRET

@dataclass(frozen=True)
class AuthCtx:
    """
    Jediný jednotný tvar identity v celej appke.

    mode:
      - "user": request z FE, JWT je povinné
      - "internal": worker/webhook/internal, JWT nie je potrebné
    """
    mode: str  # "user" | "service"
    jwt: Optional[str] = None
    caller: str = "unknown"


def get_auth_ctx(req: Request) -> AuthCtx:
    """
    Jednotné rozhodnutie auth módu.
    - INTERNAL: X-Internal-Secret musí sedieť
    - USER: Authorization Bearer <jwt> musí existovať
    """
    # 1) Internal secret (worker/webhook/internal)
    internal = req.headers.get("X-Internal-Secret")
    if internal:
        if not INTERNAL_SERVICE_SECRET:
            raise HTTPException(status_code=500, detail="Missing INTERNAL_SERVICE_SECRET")
        if internal != INTERNAL_SERVICE_SECRET:
            raise HTTPException(status_code=401, detail="Invalid internal secret")
        return AuthCtx(mode="internal", jwt=None)

    # 2) User JWT (FE)
    auth = req.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        jwt = auth.split(" ", 1)[1].strip()
        if jwt:
            return AuthCtx(mode="user", jwt=jwt)

    raise HTTPException(status_code=401, detail="Missing Authorization JWT")


def require_user(ctx: AuthCtx) -> AuthCtx:
    """Ak endpoint má byť len pre FE, zavolaj toto."""
    if ctx.mode != "user" or not ctx.jwt:
        raise HTTPException(status_code=403, detail="User-only endpoint")
    return ctx


def require_internal(ctx: AuthCtx) -> AuthCtx:
    """Ak endpoint má byť len pre worker/webhook, zavolaj toto."""
    if ctx.mode != "internal":
        raise HTTPException(status_code=403, detail="Internal-only endpoint")
    return ctx




def service_ctx(caller: str = "service") -> AuthCtx:
    return AuthCtx(mode="service", jwt=None, caller=caller)