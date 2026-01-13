from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from Services.account_delete import (
  service_get_account_delete_status,
  service_request_account_deletion,
  service_cancel_account_deletion,
)

router = APIRouter(
    prefix="/api/account/delete",
    tags=["account_delete"],
)


# -------------------------------------------------------------------
# Helper na vytiahnutie JWT z Authorization headera
# -------------------------------------------------------------------


def get_bearer_token(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> Optional[str]:
    """
    Očakáva štýl "Bearer <jwt>".
    Ak príde niečo iné, vráti None a require_jwt to potom stopne.
    """
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    # fallback – ak by si tam posielal priamo JWT
    return authorization


# -------------------------------------------------------------------
# Schemy
# -------------------------------------------------------------------


class AccountDeleteRequestIn(BaseModel):
    user_id: int


class AccountDeleteStatusOut(BaseModel):
    pending: bool
    delete_at: Optional[str] = None


# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------


@router.get("/status", response_model=AccountDeleteStatusOut)
def get_account_delete_status(
    user_id: int,
    user_jwt: Optional[str] = Depends(get_bearer_token),
):
    """
    Stav plánovaného zmazania účtu (FE volá s JWT).
    RLS v DB musí zabezpečiť, že user_id patrí JWT.
    """
    try:
        return service_get_account_delete_status(
            user_id=user_id,
            user_jwt=user_jwt,
            service=False,  # RLS režim
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request", response_model=AccountDeleteStatusOut)
def request_account_deletion(
    body: AccountDeleteRequestIn,
    user_jwt: Optional[str] = Depends(get_bearer_token),
):
    """
    Označí účet na zmazanie o 30 dní.
    """
    try:
        return service_request_account_deletion(
            user_id=body.user_id,
            user_jwt=user_jwt,
            service=False,  # RLS režim
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel", response_model=AccountDeleteStatusOut)
def cancel_account_deletion(
    body: AccountDeleteRequestIn,
    user_jwt: Optional[str] = Depends(get_bearer_token),
):
    """
    Zruší plánované zmazanie účtu.
    """
    try:
        return service_cancel_account_deletion(
            user_id=body.user_id,
            user_jwt=user_jwt,
            service=False,  # RLS režim
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(e))