from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb

def db_cleanup_deleted_activities(
    cutoff_days: int = 30,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,  # default = service-role
) -> Dict[str, Any]:
    """
    Volá SQL funkciu cleanup_deleted_activities(cutoff_days)
    a vracia jej JSON výsledok.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="maintenance_cleanup")

    resp = (
        sb.rpc(
            "cleanup_deleted_activities",
            {"cutoff_days": cutoff_days},
        )
        .execute()
    )

    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)

    if err:
        raise RuntimeError(str(err))

    return data or {}


def db_account_hard_delete(
    *,
    dry_run: bool = False,
    only_user_id: Optional[int] = None,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    Volá SQL funkciu account_hard_delete(dry_run, only_user_id)
    a vracia jej JSON výsledok.

    - dry_run=True  → nič fyzicky nemaže, len vráti, koho by mazalo
    - only_user_id → ak je zadané, obmedzí sa mazanie na daného usera
    """
    sb = get_sb(
        user_jwt=user_jwt,
        service=service,
        caller="maintenance_account_hard_delete",
    )

    params: Dict[str, Any] = {"dry_run": bool(dry_run)}
    if only_user_id is not None:
        params["only_user_id"] = int(only_user_id)

    resp = sb.rpc("account_hard_delete", params).execute()

    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)

    if err:
        raise RuntimeError(str(err))

    return data or {}
    
    
def db_cleanup_expired_activity_details(
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Dict[str, Any]:
    """
    Volá SQL funkciu cleanup_expired_activity_details()
    a vracia jej JSON výsledok.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="maintenance_cleanup_expired_details")

    resp = sb.rpc("cleanup_expired_activity_details", {}).execute()

    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)
    if err:
        raise RuntimeError(str(err))

    return data or {}