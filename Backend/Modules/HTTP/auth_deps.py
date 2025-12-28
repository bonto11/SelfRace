# Modules/HTTP/auth_deps.py
from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, status, Request


async def inject_user_jwt(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Optional[str]:
    """
    Vráti JWT pre RLS:
    1) najprv skúsi Authorization: Bearer <token>
    2) ak chýba, použije legacy cookie "jwe"
    """
    token: Optional[str] = None

    # 1) Authorization header (nový spôsob)
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    # 2) fallback: starý cookie 'jwe'
    if not token:
        token = request.cookies.get("jwe")

    # debug ak chceš:
    # print(
    #     "[inject_user_jwt]",
    #     "path=", request.url.path,
    #     "has_auth_header=", bool(authorization),
    #     "has_jwe_cookie=", bool(request.cookies.get("jwe")),
    #     "token_present=", bool(token),
    # )

    return token


async def require_user_jwt(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Verzia, ktorá JWT vyžaduje – vhodné pre routy,
    kde bez JWT nechceš pokračovať.
    """
    token = await inject_user_jwt(request, authorization=authorization)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization/JWE token",
        )

    return token