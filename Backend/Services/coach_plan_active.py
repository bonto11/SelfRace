# Services/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx

from Routes_DB.coach_plan_meta import (
    db_get_latest_plan_meta_for_user,
    db_get_active_plan_meta_for_user,
    db_update_plan_status,
    db_delete_plan_meta,  # <-- pridali sme novú mazaciu funkciu
)
from Routes_DB.coach_plan_daily import (
    db_link_session_to_activity,
    db_clear_daily_for_user_plan,
    db_check_daily_data_exists,  # <-- check pre daily
)
from Routes_DB.coach_plan_weekly import (
    db_clear_weekly_for_user_plan,
    db_check_weekly_data_exists, # <-- check pre weekly
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
    # 1) nájdi najnovší plán z meta (zvyčajne v stave 'generated')
    meta = _ensure_latest_plan_meta(user_id=user_id, ctx=ctx)
    plan_id: str = meta["plan_id"]

    # 2) nastav status = active pre daný plan_id
    updated = (
        db_update_plan_status(
            user_id=user_id,
            plan_id=plan_id,
            new_status="active",
            ctx=ctx,
        )
        or meta
    )

    return {
        "plan_id": plan_id,
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
    Ukončí aktuálny aktívny plán. Žiadna archivácia, čisté premazanie DB.
    """
    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        ctx=ctx,
    )
    if not meta:
        raise ValueError("User has no active plan to cancel.")

    plan_id = meta["plan_id"]

    # 1) Zmaž dáta z weekly a daily
    weekly_deleted = db_clear_weekly_for_user_plan(
        user_id=user_id,
        plan_id=plan_id,
        ctx=ctx,
    )
    daily_deleted = db_clear_daily_for_user_plan(
        user_id=user_id,
        plan_id=plan_id,
        ctx=ctx,
    )

    # 2) Vymaž rovno celý meta záznam (nechcem zbytočný bordel v db)
    db_delete_plan_meta(user_id=user_id, plan_id=plan_id, ctx=ctx)

    return {
        "plan_id": plan_id,
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
    cez databázovú vrstvu (žiadne priame query v service).
    """

    # 1) Najskôr skúsime nájsť aktívny plán
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    has_active = True

    # 2) Ak nie je aktívny, pozrieme najnovší (napr. status='generated')
    if not meta:
        has_active = False
        meta = db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)

    if not meta:
        return {
            "has_active": False,
            "plan_id": None,
            "has_weekly_data": False,
            "has_daily_data": False,
            "meta": None,
        }

    plan_id = meta.get("plan_id")
    has_weekly = False
    has_daily = False

    if plan_id:
        # Voláme pekne funkcie z DB vrstvy
        has_weekly = db_check_weekly_data_exists(user_id=user_id, plan_id=plan_id, ctx=ctx)
        has_daily = db_check_daily_data_exists(user_id=user_id, plan_id=plan_id, ctx=ctx)

    return {
        "has_active": has_active,
        "plan_id": plan_id,
        "has_weekly_data": has_weekly,
        "has_daily_data": has_daily,
        "meta": meta,
    }