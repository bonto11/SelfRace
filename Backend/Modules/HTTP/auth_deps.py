# Modules/HTTP/auth_deps.py
from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status


def _extract_user_jwt(
    request: Request,
    authorization: Optional[str],
) -> Optional[str]:
    """
    Snaží sa nájsť user JWT z:

      1) Authorization: Bearer <token>
      2) Supabase cookies (sb-access-token / sb:token / access_token)
      3) starý fallback 'jwe' cookie

    Validation neriešime – to spraví Supabase / RLS.
    """
    token: Optional[str] = None

    # 1) Authorization header
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip() or None

    # 2) cookies – Supabase + tvoj starý 'jwe' fallback
    if not token:
        token = (
            request.cookies.get("sb-access-token")
            or request.cookies.get("sb:token")
            or request.cookies.get("access_token")
            or request.cookies.get("jwe")
        )

    return token


async def inject_user_jwt(
    request: Request,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> Optional[str]:
    """
    Mäkký variant – vráti JWT alebo None.

    Používame ho na endpointoch, kde je JWT "optional"
    na úrovni route, ale service si ho už typicky vyžaduje
    cez vlastné `_require_jwt`.
    """
    return _extract_user_jwt(request, authorization)


async def require_user_jwt(
    user_jwt: Optional[str] = Depends(inject_user_jwt),
) -> str:
    """
    Tvrdý variant – JWT je povinné.
    - ak nie je, rovno 401
    - používa sa na väčšine coach/plan/jobs endpointov
    """
    if not user_jwt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization JWT",
        )
    return user_jwt