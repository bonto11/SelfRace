# Modules/HTTP/auth_deps.py
from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, Request, status, Depends


async def inject_user_jwt(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Optional[str]:
    """
    Získa JWT buď z Authorization: Bearer <token>, alebo z cookie (napr. 'jwe').

    Použi vo všetkých routeroch ako:
        user_jwt: Optional[str] = Depends(inject_user_jwt)
    """
    token: Optional[str] = None

    # 1) skúsiť Authorization header (to používa callBackend)
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    # 2) fallback – cookie (ak by si niekde posielal len cookies)
    if not token:
        token = request.cookies.get("jwe")

    print(
        "[inject_user_jwt]",
        "path=", request.url.path,
        "jwt_present=", bool(token),
    )
    return token


async def require_user_jwt(
    user_jwt: Optional[str] = Depends(inject_user_jwt),
) -> str:
    """
    Kompatibilné pre staršie routy, ktoré používajú Depends(require_user_jwt).
    """
    if not user_jwt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization JWT",
        )
    return user_jwt