from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx


def db_cleanup_deleted_activities(
    cutoff_days: int = 30,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Volá SQL funkciu cleanup_deleted_activities(cutoff_days)
    a vracia jej JSON výsledok.
    """
    sb = get_sb(ctx, caller="maintenance.db_cleanup_deleted_activities")

    resp = sb.rpc(
        "cleanup_deleted_activities",
        {"cutoff_days": cutoff_days},
    ).execute()

    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)

    if err:
        raise RuntimeError(str(err))

    return data or {}


def db_account_hard_delete(
    *,
    dry_run: bool = False,
    only_user_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Volá SQL funkciu account_hard_delete(dry_run, only_user_id)
    a vracia jej JSON výsledok.

    - dry_run=True  → nič fyzicky nemaže, len vráti, koho by mazalo
    - only_user_id → ak je zadané, obmedzí sa mazanie na daného usera
    """
    sb = get_sb(ctx, caller="maintenance.db_account_hard_delete")

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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Volá SQL funkciu cleanup_expired_activity_details()
    a vracia jej JSON výsledok.
    """
    sb = get_sb(ctx, caller="maintenance.db_cleanup_expired_activity_details")

    resp = sb.rpc("cleanup_expired_activity_details", {}).execute()

    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)
    if err:
        raise RuntimeError(str(err))

    return data or {}
