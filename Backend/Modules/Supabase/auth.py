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
      - "internal": worker/webhook/cron/internal, JWT nie je potrebné
    """
    mode: str  # "user" | "internal"
    jwt: Optional[str] = None
    caller: str = "unknown"

    @property
    def is_internal(self) -> bool:
        return self.mode == "internal"

    @property
    def is_user(self) -> bool:
        return self.mode == "user"


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
        return AuthCtx(mode="internal", jwt=None, caller="http_internal")

    # 2) User JWT (FE)
    auth = req.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        jwt = auth.split(" ", 1)[1].strip()
        if jwt:
            return AuthCtx(mode="user", jwt=jwt, caller="http_user")

    raise HTTPException(status_code=401, detail="Missing Authorization JWT")


def require_user(ctx: AuthCtx) -> AuthCtx:
    """Ak endpoint má byť len pre FE, zavolaj toto."""
    if ctx.mode != "user" or not ctx.jwt:
        raise HTTPException(status_code=403, detail="User-only endpoint")
    return ctx


def require_internal(ctx: AuthCtx) -> AuthCtx:
    """Ak endpoint má byť len pre worker/webhook/cron, zavolaj toto."""
    if ctx.mode != "internal":
        raise HTTPException(status_code=403, detail="Internal-only endpoint")
    return ctx


def service_ctx(caller: str = "service") -> AuthCtx:
    """
    Programovo vytvorený ctx pre worker / cron / interné volania.
    Musí byť IDENTICKÝ s tým, čo by prišlo cez X-Internal-Secret.
    """
    return AuthCtx(mode="internal", jwt=None, caller=caller)