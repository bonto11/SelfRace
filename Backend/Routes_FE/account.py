from __future__ import annotations

import os
from fastapi import APIRouter, HTTPException, Depends, Request

from Modules.HTTP.auth_deps import require_user_jwt
from Services.account import (
    service_get_account_delete_status,
    service_request_account_delete,
    service_cancel_account_delete,
)

router = APIRouter(prefix="/account", tags=["account"])


# -------------------- user-facing endpointy (JWT) --------------------
@router.get("/delete/status/{user_id}")
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


@router.post("/delete/request/{user_id}")
def request_account_delete(
    user_id: int,
    user_jwt: str = Depends(require_user_jwt),
):
    """
    Označí účet na vymazanie (delete_at = now + DELETE_GRACE_DAYS).
    """
    try:
        return service_request_account_delete(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete/cancel/{user_id}")
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
