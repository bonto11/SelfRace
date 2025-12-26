# Modules/HTTP/auth_deps.py
from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, status


async def inject_user_jwt(
    authorization: Optional[str] = Header(default=None),
) -> Optional[str]:
    """
    Vyextrahuje JWT z hlavičky Authorization: Bearer <token>
    a vráti samotný token (alebo None).

    ŽIADNA validácia, len parsovanie hlavičky.
    Použitie v routeroch:

        @router.get("/something")
        def handler(
            user_jwt: Optional[str] = Depends(inject_user_jwt),
        ):
            sb = get_client(user_jwt=user_jwt)  # RLS
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]

    # divná hlavička → radšej vrátime None
    return None
    

async def require_user_jwt(
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Kompatibilná verzia require_user_jwt pre staré routre.

    Použitie v routeroch:
        user_jwt: str = Depends(require_user_jwt)
    """

    token = await inject_user_jwt(authorization=authorization)

    if not token:
        # tu môžeš neskôr doplniť sofistikovanejšiu logiku / validáciu
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    return token