from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb

def db_get_account_delete_row(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Načíta raw riadok z account_delete_requests (alebo None).
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="account_delete")

    resp = (
        sb.table("account_delete_requests")
        .select(
            "user_id, requested_at, delete_at, cancelled_at, hard_deleted_at"
        )
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    rows = getattr(resp, "data", None) or []
    return rows[0] if rows else None


def db_upsert_account_delete_request(
    user_id: int,
    delete_at_iso: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vytvorí / updatuje požiadavku na zmazanie účtu.
    - nastaví requested_at = now, delete_at = delete_at_iso, cancelled_at = NULL
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="account_delete")

    now_iso = datetime.now(timezone.utc).isoformat()

    row = {
        "user_id": int(user_id),
        "requested_at": now_iso,
        "delete_at": delete_at_iso,
        "cancelled_at": None,
        # hard_deleted_at necháva na cron/hard-delete službu
    }

    resp = (
        sb.table("account_delete_requests")
        .upsert(row, on_conflict="user_id")
        .execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        raise RuntimeError("account_delete_requests upsert failed")

    return data[0]


def db_cancel_account_delete_request(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Zruší plánované zmazanie:
      - delete_at = NULL
      - cancelled_at = now
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="account_delete")

    now_iso = datetime.now(timezone.utc).isoformat()

    resp = (
        sb.table("account_delete_requests")
        .update(
            {
                "delete_at": None,
                "cancelled_at": now_iso,
            }
        )
        .eq("user_id", int(user_id))
        .execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        # Ak user nemal žiadny riadok, vrátime “prázdny” stav
        return {
            "user_id": int(user_id),
            "requested_at": None,
            "delete_at": None,
            "cancelled_at": now_iso,
            "hard_deleted_at": None,
        }

    return data[0]