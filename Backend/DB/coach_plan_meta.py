# DB/coach_plan_meta.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_META

def db_insert_plan_meta_generated(
    *,
    user_id: int,
    weeks_total: Optional[int],
    start_date: Optional[str],
    end_date: Optional[str],
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")
    row = {
        "user_id": user_id,
        "status": "generated",
        "weeks_total": weeks_total,
        "start_date": start_date,
        "end_date": end_date,
    }
    try:
        res = sb.table(TABLE_COACH_PLAN_META).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-META] insert_generated error:", repr(e))
        return None

def db_get_latest_plan_meta_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-META] latest_plan_meta error:", repr(e))
        return None

def db_get_active_plan_meta_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-META] active_plan_meta error:", repr(e))
        return None

# ✅ OPRAVA: Pridané meta_id pre presný update!
def db_update_plan_status(
    user_id: int,
    meta_id: int, 
    new_status: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_meta.db_update_plan_status")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .update({"status": new_status})
            .eq("id", meta_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-META] update_plan_status error:", repr(e))
        return None

def db_delete_plan_meta(user_id: int, meta_id: int, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_meta.db_delete_plan_meta")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .delete()
            .eq("user_id", user_id)
            .eq("id", meta_id) 
            .execute()
        )
        return True
    except Exception as e:
        print("[DB-COACH-META] delete_plan_meta error:", repr(e))
        return False
        
def db_archive_plan_meta(
    user_id: int,
    meta_id: int,
    new_status: str,
    final_stats: Dict[str, Any],
    ended_at: str,
    *,
    ctx: AuthCtx,
) -> bool:
    sb = get_sb(ctx, caller="coach_plan_meta.db_archive_plan_meta")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .update({
                "status": new_status,
                "final_stats": final_stats,
                "ended_at": ended_at
            })
            .eq("id", meta_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-META] archive_plan error:", repr(e))
        return False
        
def db_get_due_active_plans(today_iso: str, *, ctx: AuthCtx) -> List[int]:
    sb = get_sb(ctx, caller="coach_plan_meta.db_get_due_active_plans")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .select("user_id")
            .eq("status", "active")
            .lt("end_date", today_iso)
            .execute()
        )
        return [row["user_id"] for row in (res.data or []) if row.get("user_id")]
    except Exception as e:
        print("[DB-COACH-META] get_due_active_plans error:", repr(e))
        return []

def db_get_plan_history_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_meta.db_get_plan_history_for_user")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .select("*")
            .eq("user_id", user_id)
            .in_("status", ["completed", "canceled"])
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-META] get_plan_history error:", repr(e))
        return []