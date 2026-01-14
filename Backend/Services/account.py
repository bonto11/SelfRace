from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from Services.users import require_jwt
from Routes_DB.account import (
    db_get_account_delete_row,
    db_upsert_account_delete_request,
    db_cancel_account_delete_request,
)
from Configs.config import DELETE_GRACE_DAYS
from Modules.Supabase.client import get_sb


def _row_to_status(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Mapuje raw DB riadok -> shape pre FE:
      { pending: bool, delete_at: str | null }
    """
    if not row:
        return {"pending": False, "delete_at": None}

    delete_at = row.get("delete_at")
    cancelled_at = row.get("cancelled_at")
    hard_deleted_at = row.get("hard_deleted_at")

    pending = bool(delete_at and not cancelled_at and not hard_deleted_at)

    return {
        "pending": pending,
        "delete_at": delete_at,
    }


# -------------------------------------------------------
# 1) User-úroveň (volané z FE, cez JWT)
# -------------------------------------------------------


def service_get_account_delete_status(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Stav vymazania účtu pre daného usera.
    - service=False -> RLS (JWT povinné)
    - service=True  -> service klient (cron, admin, atď.)
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    row = db_get_account_delete_row(
        user_id=int(user_id),
        user_jwt=jwt,
        service=service,
    )

    return _row_to_status(row)


def service_request_account_delete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Označí účet na zmazanie po DELETE_GRACE_DAYS.
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    now = datetime.now(timezone.utc)
    delete_at = now + timedelta(days=DELETE_GRACE_DAYS)
    delete_at_iso = delete_at.isoformat()

    row = db_upsert_account_delete_request(
        user_id=int(user_id),
        delete_at_iso=delete_at_iso,
        user_jwt=jwt,
        service=service,
    )

    return _row_to_status(row)


def service_cancel_account_delete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Zruší plánované zmazanie účtu.
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    row = db_cancel_account_delete_request(
        user_id=int(user_id),
        user_jwt=jwt,
        service=service,
    )

    return _row_to_status(row)
