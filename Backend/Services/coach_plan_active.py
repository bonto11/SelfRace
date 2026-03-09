# Services/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone

from Modules.Supabase.auth import AuthCtx

from Routes_DB.coach_plan_meta import (
    db_get_latest_plan_meta_for_user,
    db_get_active_plan_meta_for_user,
    db_update_plan_status,
    db_delete_plan_meta,
    db_archive_plan_meta, # ✅ NOVÉ
)
from Routes_DB.coach_plan_daily import (
    db_link_session_to_activity,
    db_clear_daily_for_user_plan,
    db_check_daily_data_exists,
)
from Routes_DB.coach_plan_weekly import (
    db_clear_weekly_for_user_plan,
    db_check_weekly_data_exists,
    db_get_weekly_for_user_plan, # ✅ NOVÉ
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
    target_status: str, # "canceled" alebo "completed"
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Ukončí plán. 
    Ak bol len vygenerovaný -> Hard delete (nezostal v histórii).
    Ak bol aktívny -> Zosumarizuje weekly dáta, uloží ich do meta ako snapshot,
                      nastaví status na canceled/completed a vymaže daily/weekly tabuľky.
    """
    meta = db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)
    
    if not meta:
        return {"meta": None, "archived": False, "deleted": False}

    current_status = meta.get("status")
    meta_id = meta.get("id")

    # 1. Ak plán ešte ani nezačal, len ho celý bez stopy vymažeme
    if current_status == "generated":
        weekly_deleted = db_clear_weekly_for_user_plan(user_id=user_id, ctx=ctx)
        daily_deleted = db_clear_daily_for_user_plan(user_id=user_id, ctx=ctx)
        db_delete_plan_meta(user_id=user_id, ctx=ctx)
        return {"meta": None, "archived": False, "deleted": True}

    # 2. Ak bol aktívny, urobíme Snapshot
    if current_status == "active":
        weeks = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx)
        
        final_planned = {}
        final_actual = {}

        # Sčítanie všetkých hodnôt v JSONB objektoch naprieč všetkými týždňami
        for w in weeks:
            ps = w.get("planned_stats") or {}
            as_ = w.get("actual_stats") or {}
            
            for k, v in ps.items():
                final_planned[k] = final_planned.get(k, 0) + (v or 0)
            for k, v in as_.items():
                final_actual[k] = final_actual.get(k, 0) + (v or 0)

        # Zaokrúhlenie pre pekné JSONy (ak sú to km s desatinnými miestami)
        for k in final_planned:
            if isinstance(final_planned[k], float): 
                final_planned[k] = round(final_planned[k], 2)
        for k in final_actual:
            if isinstance(final_actual[k], float): 
                final_actual[k] = round(final_actual[k], 2)

        final_stats = {
            "weeks_tracked": len(weeks),
            "weeks_total_planned": meta.get("weeks_total"),
            "final_planned_stats": final_planned,
            "final_actual_stats": final_actual,
        }

        ended_at = datetime.now(timezone.utc).isoformat()

        # Uložíme zmenu do databázy
        archived = db_archive_plan_meta(
            user_id=user_id,
            meta_id=meta_id,
            new_status=target_status,
            final_stats=final_stats,
            ended_at=ended_at,
            ctx=ctx
        )

        # Vyčistíme staré data, ktoré už nepotrebujeme
        db_clear_weekly_for_user_plan(user_id=user_id, ctx=ctx)
        db_clear_daily_for_user_plan(user_id=user_id, ctx=ctx)

        return {"meta": meta_id, "archived": archived, "deleted": True}

    return {"meta": None, "archived": False, "deleted": False}


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
    Zistí, či má user aktívny (alebo vygenerovaný) plán a skontroluje dáta.
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
