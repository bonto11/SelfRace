from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from Services.account import (
    service_get_account_delete_status,
    service_request_account_delete,
    service_cancel_account_delete,
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/account", tags=["account"])


# -------------------- user-facing endpointy (JWT) --------------------
@router.get("/delete/status/{user_id}")
def get_account_delete_status(
    user_id: int,
    req: Request,
):
    """
    Vráti, či je účet označený na vymazanie a plánovaný dátum delete.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        return service_get_account_delete_status(
            user_id=user_id,
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete/request/{user_id}")
def request_account_delete(
    user_id: int,
    req: Request,
):
    """
    Označí účet na vymazanie (delete_at = now + DELETE_GRACE_DAYS).
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        return service_request_account_delete(
            user_id=user_id,
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete/cancel/{user_id}")
def cancel_account_delete(
    user_id: int,
    req: Request,
):
    """
    Zruší pending delete flag (delete_at = NULL).
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        return service_cancel_account_delete(
            user_id=user_id,
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
