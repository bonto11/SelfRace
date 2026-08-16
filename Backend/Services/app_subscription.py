# Services/app_subscription.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from Modules.Supabase.auth import AuthCtx

from DB.app_subscription import (
    db_list_app_subscription_tiers,
    db_get_app_subscription_tier_by_code,
    db_insert_app_user_subscription,
    db_update_app_user_subscription_status,
    db_list_app_user_subscriptions,
    db_get_active_app_subscription_for_user,
    db_list_due_subscription_changes,
)

TIER_ORDER: Dict[str, int] = {
    "free": 0,
    "classic": 1,
    "pro": 2,
    "family": 3,
}


def _tier_rank(code: str) -> int:
    return TIER_ORDER.get(code, 0)


# ---------- TIERS ----------


def service_list_app_subscription_tiers(
    *,
    include_inactive: bool = False,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    return db_list_app_subscription_tiers(
        include_inactive=include_inactive,
        ctx=ctx,
    )


# ---------- STATUS / HISTORY ----------


def service_get_user_app_subscription_status(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    tiers = db_list_app_subscription_tiers(
        include_inactive=False,
        ctx=ctx,
    )

    active = db_get_active_app_subscription_for_user(
        user_id=user_id,
        ctx=ctx,
    )

    # Ak nemá aktívny plán, skontrolujeme, či je to úplne nový používateľ
    if not active:
        history = db_list_app_user_subscriptions(user_id=user_id, limit=1, ctx=ctx)
        if not history:
            try:
                trial_res = service_start_pro_trial(user_id=user_id, ctx=ctx)
                if trial_res.get("success"):
                    active = trial_res.get("subscription")
            except Exception as e:
                print("[APP_SUBSCRIPTION] trial insert race, refetching active:", repr(e))
                active = db_get_active_app_subscription_for_user(user_id=user_id, ctx=ctx)

    effective_tier = "free"
    scheduled_change: Optional[Dict[str, Any]] = None

    if active:
        effective_tier = str(active.get("tier_code") or "free")
        meta = active.get("meta") or {}

        if active.get("cancel_at_period_end"):
            if (
                meta.get("pending_downgrade_to")
                and meta["pending_downgrade_to"] != "free"
            ):
                scheduled_change = {
                    "kind": "downgrade",
                    "to_tier_code": str(meta["pending_downgrade_to"]),
                    "effective_from": active.get("current_period_end"),
                }
            else:
                # pending_cancel alebo downgrade na free
                scheduled_change = {
                    "kind": "cancel",
                    "to_tier_code": "free",
                    "effective_from": active.get("current_period_end"),
                }

    return {
        "user_id": user_id,
        "tier_code": effective_tier,
        "active_subscription": active,
        "tiers": tiers,
        "scheduled_change": scheduled_change,
    }


def service_list_user_app_subscriptions(
    *,
    user_id: int,
    limit: int = 20,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    return db_list_app_user_subscriptions(
        user_id=user_id,
        limit=limit,
        ctx=ctx,
    )


# ---------- DEV: manuálne prepnutie tieru ----------


def service_set_user_app_subscription_tier_manual(
    *,
    user_id: int,
    tier_code: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    tier_code = tier_code.strip().lower()
    if not tier_code:
        raise ValueError("tier_code is required")

    if tier_code != "free":
        tier = db_get_app_subscription_tier_by_code(
            code=tier_code,
            ctx=ctx,
        )
        if not tier:
            raise ValueError(f"Unknown subscription tier: {tier_code!r}")
    else:
        tier = None

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    active = db_get_active_app_subscription_for_user(
        user_id=user_id,
        ctx=ctx,
    )

    current_code = str(active.get("tier_code")) if active else "free"
    current_rank = _tier_rank(current_code)
    new_rank = _tier_rank(tier_code)

    new_active: Optional[Dict[str, Any]] = None

    if tier_code != "free" and (not active or new_rank > current_rank):
        # ---------- UPGRADE (alebo prvé platené členstvo) ----------
        if active and active.get("id"):
            db_update_app_user_subscription_status(
                subscription_id=int(active["id"]),
                status="cancelled",
                current_period_end=now_iso,
                ctx=ctx,
            )

        start_iso = now_iso
        end_iso = (now + timedelta(days=30)).isoformat()

        new_active = db_insert_app_user_subscription(
            user_id=user_id,
            tier_code=tier_code,
            status="active",
            current_period_start=start_iso,
            current_period_end=end_iso,
            cancel_at_period_end=False,
            external_customer_id=None,
            external_subscription_id=None,
            meta={"source": "manual_dev_upgrade"},
            ctx=ctx,
        )

    elif active and active.get("id"):
        # ---------- DOWNGRADE alebo prechod na FREE (cancel) ----------
        period_end_raw = active.get("current_period_end")
        if isinstance(period_end_raw, str):
            period_end_iso = period_end_raw
        else:
            period_end_iso = (now + timedelta(days=30)).isoformat()

        meta = dict(active.get("meta") or {})
        if tier_code == "free":
            meta["pending_downgrade_to"] = "free"
            meta["pending_cancel"] = True
        else:
            meta["pending_downgrade_to"] = tier_code

        updated = db_update_app_user_subscription_status(
            subscription_id=int(active["id"]),
            status="active",
            current_period_end=period_end_iso,
            cancel_at_period_end=True,
            meta_patch=meta,
            ctx=ctx,
        )
        new_active = updated
    else:
        # free -> free, nič
        new_active = active

    status = service_get_user_app_subscription_status(
        user_id=user_id,
        ctx=ctx,
    )

    return {
        "user": None,
        "active_subscription": new_active,
        "tier": tier,
        "status": status,
    }


# ---------- CRON: aplikovanie plánovaných zmien ----------


def service_apply_due_subscription_changes(
    *,
    now: Optional[datetime] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    now_iso = now.isoformat()

    due_rows = db_list_due_subscription_changes(
        now_iso=now_iso,
        ctx=ctx,
    )

    processed: List[Dict[str, Any]] = []

    for row in due_rows:
        sub_id = int(row["id"])
        user_id = int(row["user_id"])
        current_tier = str(row.get("tier_code") or "free")
        meta = dict(row.get("meta") or {})

        target_tier = meta.pop("pending_downgrade_to", "free")
        pending_cancel = bool(meta.pop("pending_cancel", False))

        period_end_raw = row.get("current_period_end")
        if isinstance(period_end_raw, str):
            start_dt = datetime.fromisoformat(period_end_raw.replace("Z", "+00:00"))
        else:
            start_dt = now
        end_dt = start_dt + timedelta(days=30)

        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()

        # ukonči starý subscription
        db_update_app_user_subscription_status(
            subscription_id=sub_id,
            status="cancelled",
            current_period_end=start_iso,
            cancel_at_period_end=False,
            meta_patch=meta,
            ctx=ctx,
        )

        if pending_cancel or target_tier == "free":
            processed.append(
                {
                    "user_id": user_id,
                    "prev_tier": current_tier,
                    "action": "cancel",
                }
            )
            continue

        # vytvor downgradnutý subscription
        new_sub = db_insert_app_user_subscription(
            user_id=user_id,
            tier_code=target_tier,
            status="active",
            current_period_start=start_iso,
            current_period_end=end_iso,
            cancel_at_period_end=False,
            external_customer_id=row.get("external_customer_id"),
            external_subscription_id=row.get("external_subscription_id"),
            meta={
                "source": "downgrade_cron",
                "previous_subscription_id": sub_id,
            },
            ctx=ctx,
        )

        processed.append(
            {
                "user_id": user_id,
                "prev_tier": current_tier,
                "new_tier": target_tier,
                "action": "downgrade",
                "new_subscription_id": new_sub.get("id"),
            }
        )

    return {"now": now_iso, "count": len(processed), "items": processed}


def service_cancel_scheduled_subscription_change(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    active = db_get_active_app_subscription_for_user(
        user_id=user_id,
        ctx=ctx,
    )
    if not active:
        raise ValueError("No active subscription to update.")

    sub_id = int(active["id"])
    meta = dict(active.get("meta") or {})
    changed = False

    if meta.pop("pending_downgrade_to", None) is not None:
        changed = True
    if meta.pop("pending_cancel", None) is not None:
        changed = True

    if not active.get("cancel_at_period_end") and not changed:
        return {"active_subscription": active, "tier": None, "user": None}

    updated = db_update_app_user_subscription_status(
        subscription_id=sub_id,
        status=active.get("status", "active"),
        cancel_at_period_end=False,
        meta_patch=meta,
        ctx=ctx,
    )

    tier = db_get_app_subscription_tier_by_code(
        code=str(updated.get("tier_code")),
        ctx=ctx,
    )

    return {
        "active_subscription": updated,
        "tier": tier,
    }


def service_start_pro_trial(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Aktivuje 31-dňový PRO trial pre nového používateľa.
    """
    # 1. Skontrolujeme, či už náhodou nemá aktívne predplatné
    active = db_get_active_app_subscription_for_user(
        user_id=user_id,
        ctx=ctx,
    )

    if active:
        return {"success": False, "detail": "User already has an active subscription."}

    # 2. Vypočítame dátumy (dnes + 31 dní)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    end_iso = (now + timedelta(days=31)).isoformat()

    # 3. Vytvoríme ACTIVE trial
    new_active = db_insert_app_user_subscription(
        user_id=user_id,
        tier_code="pro",
        status="active",
        current_period_start=now_iso,
        current_period_end=end_iso,
        cancel_at_period_end=True,  # Kľúčové pre CRON
        external_customer_id=None,
        external_subscription_id=None,
        meta={
            "source": "registration_pro_trial",
            "pending_downgrade_to": "free",  # Kľúčové pre CRON
            "pending_cancel": True,
        },
        ctx=ctx,
    )

    return {"success": True, "trial_end": end_iso, "subscription": new_active}
