# Modules/HTTP/auth_deps.py
from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, Request, status


async def inject_user_jwt(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Optional[str]:
    """
    Vráti JWT z:
      1) Authorization: Bearer <token>
      2) alebo z 'jwe' cookie (fallback)

    Bez validácie – to rieši DB / RLS.
    """
    token: Optional[str] = None

    # 1) Authorization header
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    # 2) fallback: jwe cookie (ako doteraz)
    if not token:
        token = request.cookies.get("jwe")

    return token


async def require_user_jwt(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Verzia, ktorá JWT vyžaduje – použiješ tam, kde chceš 401 na unauth.
    """
    token = await inject_user_jwt(request=request, authorization=authorization)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid JWT",
        )

    return token