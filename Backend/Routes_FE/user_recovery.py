# Routes_FE/user_recovery.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header

from Services.user_recovery import (
    service_insert_or_update_recovery,
    service_get_recovery,
)
from Schemas.user_recovery import RecoveryIn

router = APIRouter(prefix="/recovery", tags=["recovery"])


def _extract_jwt(authorization: str | None) -> str | None:
    """
    Zoberie Authorization: Bearer <token> a vráti len <token>.
    Ak hlavička chýba alebo je v divnom formáte → None.
    """
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


@router.post("")
def post_recovery(
    payload: RecoveryIn,
    authorization: str | None = Header(default=None),
):
    """
    Insert alebo update recovery.
    Flexibilné: ak existuje user_id+date → update, inak insert.
    """
    jwt = _extract_jwt(authorization)

    try:
        res = service_insert_or_update_recovery(
            payload.model_dump(),
            user_jwt=jwt,
        )
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
def get_recovery(
    user_id: int,
    days: int = 14,
    authorization: str | None = Header(default=None),
):
    """
    Vráti posledné N dní recovery záznamov.
    """
    jwt = _extract_jwt(authorization)

    try:
        data = service_get_recovery(
            user_id,
            days,
            user_jwt=jwt,
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))