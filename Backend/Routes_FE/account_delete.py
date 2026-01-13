# Routes_FE/account_delete.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends

from Modules.HTTP.auth_deps import require_user_jwt
from Services.account_delete import (
    service_get_account_delete_status,
    service_request_account_delete,
    service_cancel_account_delete,
)

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/{user_id}/delete/status")
def get_account_delete_status(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Vráti, či je účet označený na vymazanie a plánovaný dátum delete.
    """
    try:
        return service_get_account_delete_status(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/delete/request")
def request_account_delete(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Označí účet na zmazanie (delete_at = now + DELETE_GRACE_DAYS).
    """
    try:
        return service_request_account_delete(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/delete/cancel")
def cancel_account_delete(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Zruší pending delete flag (delete_at = NULL).
    """
    try:
        return service_cancel_account_delete(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))