from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from DB.account import (
    db_get_account_delete_row,
    db_upsert_account_delete_request,
    db_cancel_account_delete_request,
)

from Modules.Supabase.auth import AuthCtx

from Modules.Stripe.billing_stripe import disconnect_stripe_subscription
from Modules.Strava.strava_disconnect_helpers import disconnect_strava_account
from Configs.config import DELETE_GRACE_DAYS


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def service_get_account_delete_status(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    row = db_get_account_delete_row(
        user_id=int(user_id),
        ctx=ctx
    )

    if not row:
        return {
            "user_id": int(user_id),
            "pending": False,
            "status": "none",
            "requested_at": None,
            "delete_at": None,
            "cancelled_at": None,
            "hard_deleted_at": None,
        }

    delete_at = row.get("delete_at")
    cancelled_at = row.get("cancelled_at")
    hard_deleted_at = row.get("hard_deleted_at")

    # status precedence
    if hard_deleted_at:
        status = "deleted"
    elif cancelled_at:
        status = "cancelled"
    elif delete_at:
        status = "pending"
    else:
        # prakticky nenastane, lebo delete_at je NOT NULL, ale nech je to safe
        status = "none"

    pending = status == "pending"

    return {
        "user_id": int(user_id),
        "pending": pending,
        "status": status,
        "requested_at": row.get("requested_at"),
        "delete_at": delete_at,
        "cancelled_at": cancelled_at,
        "hard_deleted_at": hard_deleted_at,
    }


def service_request_account_delete(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    - okamžite odpoj Stravu + vymaž Strava data (best effort)
    - okamžite zruš Stripe predplatné (cancel at period end)
    - vytvor delete request (grace 7 dní)
    """
    # 1) Strava disconnect (best effort, bez checkboxu – je to interný flow)
    strava_res = disconnect_strava_account(
        user_id=int(user_id),
        reason="account_delete_request",
        purge_data=True,
    )

    # 1.5) Stripe disconnect (best effort)
    stripe_res = disconnect_stripe_subscription(
        user_id=int(user_id),
        ctx=ctx
    )

    # 2) vytvor delete request
    delete_at = _now_utc() + timedelta(days=DELETE_GRACE_DAYS)
    row = db_upsert_account_delete_request(
        user_id=int(user_id), delete_at_iso=_iso(delete_at), ctx=ctx
    )

    return {
        "ok": True,
        "user_id": int(user_id),
        "delete_at": row.get("delete_at"),
        "requested_at": row.get("requested_at"),
        "grace_days": DELETE_GRACE_DAYS,
        "strava_disconnect": strava_res,
        "stripe_disconnect": stripe_res,
    }


def service_cancel_account_delete(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    row = db_cancel_account_delete_request(
        user_id=int(user_id),
        ctx=ctx,
    )
    return {
        "ok": True,
        "user_id": int(user_id),
        "cancelled_at": row.get("cancelled_at"),
        "delete_at": row.get("delete_at"),
    }
