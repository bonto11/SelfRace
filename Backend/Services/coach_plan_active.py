# Services/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx

from Routes_DB.coach_plan_meta import (
    db_get_latest_plan_meta_for_user,
    db_get_active_plan_meta_for_user,
    db_update_plan_status,
    db_delete_plan_meta,
)
from Routes_DB.coach_plan_daily import (
    db_link_session_to_activity,
    db_clear_daily_for_user_plan,
    db_check_daily_data_exists,
)
from Routes_DB.coach_plan_weekly import (
    db_clear_weekly_for_user_plan,
    db_check_weekly_data_exists,
)


def _ensure_latest_plan_meta(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    meta = db_get_latest_plan_meta_for_user(
        user_id=user_id,
        ctx=ctx,
    )
    if not meta:
        raise ValueError("No generated plan meta found for this user.")
    return meta


def service_save_active_plan(
    user_id: int,
    payload: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Aktivuje najnovší vygenerovaný plán.
    """
    meta = _ensure_latest_plan_meta(user_id=user_id, ctx=ctx)

    updated = (
        db_update_plan_status(
            user_id=user_id,
            new_status="active",
            ctx=ctx,
        )
        or meta
    )

    return {
        "plan_start": updated.get("start_date"),
        "plan_end": updated.get("end_date"),
        "weeks": updated.get("weeks_total"),
        "meta": updated,
    }


def service_cancel_active_plan(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Ukončí a zmaže akýkoľvek rozpracovaný alebo aktívny plán. 
    Žiadna archivácia, čisté premazanie DB.
    """
    # ✅ ZMENA: Použijeme "latest" namiesto "active", 
    # aby sme vedeli zmazať aj plán, ktorý je len vo fáze "Weekly" (generated)
    meta = db_get_latest_plan_meta_for_user(
        user_id=user_id,
        ctx=ctx,
    )
    
    if not meta:
        # Ak nie je čo mazať, proste vrátime success, nebudeme zhadzovať FE chybou.
        return {
            "meta": None,
            "weekly_deleted": False,
            "daily_deleted": False,
        }

    # 1) Zmaž dáta z weekly a daily
    weekly_deleted = db_clear_weekly_for_user_plan(
        user_id=user_id,
        ctx=ctx,
    )
    daily_deleted = db_clear_daily_for_user_plan(
        user_id=user_id,
        ctx=ctx,
    )

    # 2) Vymaž rovno celý meta záznam
    db_delete_plan_meta(user_id=user_id, ctx=ctx)

    return {
        "meta": None,
        "weekly_deleted": weekly_deleted,
        "daily_deleted": daily_deleted,
    }


def service_link_activity(
    user_id: int,
    id: int,
    activity_id: Optional[int],
    *,
    ctx: AuthCtx,
) -> bool:
    try:
        db_link_session_to_activity(
            user_id=user_id,
            id=id, activity_id=activity_id, ctx=ctx
        )
        return True
    except Exception:
        return False


def service_get_active_plan_status(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Zistí, či má user aktívny (alebo vygenerovaný) plán a skontroluje dáta 
    cez databázovú vrstvu.
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    has_active = True

    if not meta:
        has_active = False
        meta = db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)

    if not meta:
        return {
            "has_active": False,
            "has_weekly_data": False,
            "has_daily_data": False,
            "meta": None,
        }

    has_weekly = db_check_weekly_data_exists(user_id=user_id, ctx=ctx)
    has_daily = db_check_daily_data_exists(user_id=user_id, ctx=ctx)

    return {
        "has_active": has_active,
        "has_weekly_data": has_weekly,
        "has_daily_data": has_daily,
        "meta": meta,
    }