from __future__ import annotations

import os
from fastapi import APIRouter, HTTPException, Depends, Request

from Modules.HTTP.auth_deps import require_user_jwt
from Services.account_delete import (
    service_get_account_delete_status,
    service_request_account_delete,
    service_cancel_account_delete,
    service_hard_delete_due_accounts,
)

router = APIRouter(prefix="/account", tags=["account"])


# -------------------- helper na maintenance API key --------------------


def get_maintenance_api_key_env() -> str:
    v = os.getenv("MAINTENANCE_API_KEY")
    if not v:
        raise RuntimeError("MAINTENANCE_API_KEY is not set")
    return v


def require_maintenance_api_key(request: Request):
    """
    Použije sa pre cron route – očakáva hlavičku X-API-Key.
    """
    expected = get_maintenance_api_key_env()
    sent = request.headers.get("X-API-Key")

    if not sent or sent != expected:
        raise HTTPException(status_code=403, detail="invalid maintenance api key")


# -------------------- user-facing endpointy (JWT) --------------------


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


# -------------------- cron endpoint (GitHub Action) --------------------


@router.post("/delete/cron/hard-delete")
def cron_account_hard_delete(
    _: None = Depends(require_maintenance_api_key),
):
    """
    Cron endpoint volaný z GitHub Actions:
    - nájde všetky account_delete_requests, ktoré majú delete_at <= now
      a ešte nemajú hard_deleted_at,
    - zmaže ich dáta z DB,
    - nastaví hard_deleted_at.
    """
    try:
        res = service_hard_delete_due_accounts(limit=100)
        return res
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))