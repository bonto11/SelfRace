# Services/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from Modules.Supabase.auth import AuthCtx

from DB.coach_plan_meta import (
    db_get_latest_plan_meta_for_user,
    db_get_active_plan_meta_for_user,
    db_update_plan_status,
    db_delete_plan_meta,
    db_archive_plan_meta,
    db_get_due_active_plans,
    db_get_plan_history_for_user,
)
from DB.coach_plan_daily import (
    db_link_session_to_activity,
    db_clear_daily_for_user_plan,
    db_check_daily_data_exists,
)
from DB.coach_plan_weekly import (
    db_clear_weekly_for_user_plan,
    db_check_weekly_data_exists,
    db_get_weekly_for_user_plan,
)
from DB.coach_strength_history import db_clear_strength_history_for_user


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
    meta = _ensure_latest_plan_meta(user_id=user_id, ctx=ctx)
    meta_id = meta.get("id")
    
    if not meta_id:
        raise ValueError("Cannot activate plan without a valid ID.")

    updated = db_update_plan_status(
        user_id=user_id,
        meta_id=meta_id,
        new_status="active",
        ctx=ctx,
    )
    
    final_meta = updated if updated else meta

    return {
        "plan_start": final_meta.get("start_date"),
        "plan_end": final_meta.get("end_date"),
        "weeks": final_meta.get("weeks_total"),
        "meta": final_meta,
    }


def service_cancel_active_plan(
    user_id: int,
    target_status: str, 
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    meta = db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta: return {"meta": None, "archived": False, "deleted": False}

    current_status = meta.get("status")
    meta_id = meta.get("id")
    if not meta_id: return {"meta": None, "archived": False, "deleted": False}
        
    meta_id = int(meta_id)

    if current_status == "generated":
        db_clear_weekly_for_user_plan(user_id=user_id, ctx=ctx)
        db_clear_daily_for_user_plan(user_id=user_id, ctx=ctx)
        db_clear_strength_history_for_user(user_id=user_id, ctx=ctx)
        db_delete_plan_meta(user_id=user_id, ctx=ctx, meta_id=meta_id)
        return {"meta": None, "archived": False, "deleted": True}

    if current_status == "active":
        weeks = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx)
        
        final_planned = {}
        final_actual = {}

        for w in weeks:
            ps = w.get("planned_stats") or {}
            as_ = w.get("actual_stats") or {}
            
            for k, v in ps.items():
                final_planned[k] = final_planned.get(k, 0) + (v or 0)
            for k, v in as_.items():
                final_actual[k] = final_actual.get(k, 0) + (v or 0)

        for k in final_planned:
            if isinstance(final_planned[k], float): final_planned[k] = round(final_planned[k], 2)
        for k in final_actual:
            if isinstance(final_actual[k], float): final_actual[k] = round(final_actual[k], 2)

        final_stats = {
            "weeks_tracked": len(weeks),
            "weeks_total_planned": meta.get("weeks_total"),
            "final_planned_stats": final_planned,
            "final_actual_stats": final_actual,
        }

        ended_at = datetime.now(timezone.utc).isoformat()

        archived = db_archive_plan_meta(
            user_id=user_id,
            meta_id=meta_id,
            new_status=target_status,
            final_stats=final_stats,
            ended_at=ended_at,
            ctx=ctx
        )

        db_clear_weekly_for_user_plan(user_id=user_id, ctx=ctx)
        db_clear_daily_for_user_plan(user_id=user_id, ctx=ctx)
        db_clear_strength_history_for_user(user_id=user_id, ctx=ctx)

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

def service_complete_due_active_plans(*, ctx: AuthCtx) -> Dict[str, Any]:
    # OPRAVA: Použijeme lokálny čas, nie UTC!
    tz_ba = ZoneInfo("Europe/Bratislava")
    today_iso = datetime.now(tz_ba).date().isoformat()
    
    users_to_complete = db_get_due_active_plans(today_iso=today_iso, ctx=ctx)

    processed = 0
    errors = 0

    for uid in users_to_complete:
        try:
            service_cancel_active_plan(user_id=uid, target_status="completed", ctx=ctx)
            processed += 1
        except Exception as e:
            print(f"[MAINTENANCE] Failed to complete plan for user {uid}: {repr(e)}")
            errors += 1

    return {
        "processed_users": processed,
        "errors": errors,
        "note": f"Checked against local date {today_iso}"
    }
    
def service_get_plan_history(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    return db_get_plan_history_for_user(user_id=user_id, ctx=ctx)