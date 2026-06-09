# DB/coach_plan_daily.py
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta, date
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_DAILY
from DB.coach_plan_meta import db_get_active_plan_meta_for_user

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def db_insert_daily_rows(rows: List[Dict[str, Any]], *, ctx: AuthCtx) -> int:
    if not rows: return 0
    sb = get_sb(ctx, caller="coach_plan_daily.db_insert_daily_rows")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).insert(rows).execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] insert error:", repr(e))
        return 0

def db_clear_daily_for_user_week(user_id: int, week_start: str, week_end: str, *, ctx: AuthCtx) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_week")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .gte("plan_date", week_start)
            .lte("plan_date", week_end)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] clear error:", repr(e))
        return 0

def db_get_planned_range_rows(user_id: int, date_from: str, date_to: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_planned_range_rows")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
            .order("plan_date", desc=False)
            .order("session_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] get_planned_range_rows error:", repr(e))
        return []

def db_link_session_to_activity(user_id: int, *, ctx: AuthCtx, id: int, activity_id: Optional[int]) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_link_session_to_activity")
    
    try:
        # First, we need to know the plan_date of the session to determine the new status
        # if we are unlinking it.
        session_res = sb.table(TABLE_COACH_PLAN_DAILY).select("plan_date").eq("id", int(id)).eq("user_id", int(user_id)).execute()
        session_data = session_res.data or []
        
        if not session_data:
            return None
            
        plan_date_str = session_data[0].get("plan_date")
        
        # Determine status:
        if activity_id:
            new_status = "done"
        else:
            # If unlinking, check if the date is in the past
            today_str = date.today().isoformat()
            if plan_date_str and plan_date_str < today_str:
                new_status = "missed"
            else:
                new_status = "planned"

        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update({
                "activity_id": activity_id, 
                "status": new_status, 
                "updated_at": _now_iso()
            })
            .eq("id", int(id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] link_session_to_activity error:", repr(e))
        return None

def db_has_uncompleted_daily_sessions(user_id: int, plan_date: str, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_has_uncompleted_daily_sessions")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id")
            .eq("user_id", int(user_id))
            .eq("plan_date", plan_date)
            .eq("status", "planned") 
            .limit(1)
            .execute()
        )
        return len(res.data or []) > 0
    except Exception as e:
        print("[DB-COACH-DAILY] has_uncompleted_sessions error:", repr(e))
        return False

def db_list_daily_for_user_horizon(user_id: int, horizon_days: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    if horizon_days <= 0: horizon_days = 7
    today = date.today()
    date_from = today.isoformat()
    date_to = (today + timedelta(days=horizon_days)).isoformat()
    sb = get_sb(ctx, caller="coach_plan_daily.db_list_daily_for_user_horizon")
    try:
        query = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
            .order("plan_date", desc=False)
            .order("session_index", desc=False)
        )
        res = query.execute()
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] db_list_daily_for_user_horizon error:", repr(e))
        return []

def db_clear_daily_for_user_plan(user_id: int, *, ctx: AuthCtx) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_plan")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] clear_plan error:", repr(e))
        return 0

def db_clear_daily_for_user_range(
    user_id: int,
    date_from: str,
    date_to: str,
    *,
    ctx: AuthCtx,
    global_user_clear: bool = False
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_range")
    try:
        query = sb.table(TABLE_COACH_PLAN_DAILY).delete().eq("user_id", user_id).gte("plan_date", date_from).lte("plan_date", date_to)
            
        res = query.execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] clear_range error:", repr(e))
        return 0

def db_get_daily_session_by_id(user_id: int, id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_daily_session_by_id")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).select("id,user_id,plan_date,session_index").eq("id", int(id)).eq("user_id", int(user_id)).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] get_session_by_id error:", repr(e))
        return None

def db_count_sessions_on_day(user_id: int, plan_date: str, *, ctx: AuthCtx) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_count_sessions_on_day")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).select("id").eq("user_id", int(user_id)).eq("plan_date", str(plan_date)).execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] count_sessions_on_day error:", repr(e))
        return 0

def db_get_max_session_index_on_day(user_id: int, plan_date: str, *, ctx: AuthCtx) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_max_session_index_on_day")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).select("session_index").eq("user_id", int(user_id)).eq("plan_date", str(plan_date)).order("session_index", desc=True).limit(1).execute()
        rows = res.data or []
        if not rows: return -1
        v = rows[0].get("session_index")
        return int(v) if v is not None else -1
    except Exception as e:
        print("[DB-COACH-DAILY] max_session_index_on_day error:", repr(e))
        return -1

def db_update_daily_session_date(user_id: int, id: int, *, plan_date: str, session_index: int, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_update_daily_session_date")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).update({"plan_date": str(plan_date), "session_index": int(session_index), "updated_at": _now_iso()}).eq("id", int(id)).eq("user_id", int(user_id)).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] update_daily_session_date error:", repr(e))
        return None

def db_reschedule_daily_sessions_bulk(user_id: int, *, moves: List[Dict[str, Any]], max_per_day: int = 2, ctx: AuthCtx) -> Dict[str, Any]:
    if not moves: return {"ok": True, "updated": 0}
    updated = 0
    errors: List[Dict[str, Any]] = []

    for m in moves:
        try:
            sid = m.get("id")
            from_date = str(m.get("from_date") or "")[:10]
            to_date = str(m.get("to_date") or "")[:10]

            if not sid or not to_date: raise ValueError("missing id/to_date")
            row = db_get_daily_session_by_id(user_id=user_id, id=sid, ctx=ctx)
            if not row: raise ValueError("session_not_found_or_not_owned")

            current_date = str(row.get("plan_date") or "")[:10]

            if to_date == current_date: continue
            cnt = db_count_sessions_on_day(user_id=user_id, plan_date=to_date, ctx=ctx)
            if cnt >= int(max_per_day or 2): raise ValueError("target_day_full")

            max_idx = db_get_max_session_index_on_day(user_id=user_id, plan_date=to_date, ctx=ctx)
            next_idx = int(max_idx + 1)
            upd = db_update_daily_session_date(user_id=user_id, id=sid, plan_date=to_date, session_index=next_idx, ctx=ctx)
            if not upd: raise ValueError("update_failed")
            updated += 1
        except Exception as e:
            errors.append({"id": m.get("id"), "error": str(e)})

    if errors: return {"ok": False, "updated": updated, "error": "some_moves_failed", "errors": errors}
    return {"ok": True, "updated": updated}
    
    
def db_check_daily_data_exists(user_id: int, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_check_daily_data_exists")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-DAILY] check_exists error:", repr(e))
        return False
    
def db_delete_future_daily_plans(user_id: int, from_date: str, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_delete_future")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .gte("plan_date", from_date)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-DAILY] delete future error:", repr(e))
        return False
        
def db_delete_daily_session(user_id: int, session_id: int, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_delete_daily_session")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print(f"[DB-COACH-DAILY] delete_daily_session error: {repr(e)}")
        return False

def db_update_daily_session_data(user_id: int, session_id: int, update_data: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_update_daily_session_data")
    try:
        # We need to fetch the existing row to see what the plan_date is, 
        # so we can set status to 'missed' if it's in the past and they are unmatching.
        session_res = sb.table(TABLE_COACH_PLAN_DAILY).select("plan_date").eq("id", int(session_id)).eq("user_id", int(user_id)).execute()
        session_data = session_res.data or []
        
        if not session_data:
            return None
            
        plan_date_str = session_data[0].get("plan_date")

        payload = dict(update_data)
        payload["updated_at"] = _now_iso()
        
        # If the user is unmatching (activity_id is explicitly set to None)
        # AND they haven't manually passed in a 'status' override, we calculate it.
        if "activity_id" in payload and payload["activity_id"] is None and "status" not in payload:
             today_str = date.today().isoformat()
             if plan_date_str and plan_date_str < today_str:
                 payload["status"] = "missed"
             else:
                 payload["status"] = "planned"

        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update(payload)
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[DB-COACH-DAILY] update_daily_session_data error: {repr(e)}")
        return None
    
def db_get_compliance_stats(user_id: int, days: int = 30, *, ctx: AuthCtx) -> Dict[str, int]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_compliance_stats")
    try:
        active_plan = db_get_active_plan_meta_for_user(user_id, ctx=ctx)

        # FIX: select aj plan_date, nielen status
        query = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("status, plan_date")
            .eq("user_id", user_id)
        )

        if active_plan and active_plan.get("start_date"):
            query = query.gte("plan_date", active_plan["start_date"])
        else:
            since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
            query = query.gte("plan_date", since)

        # Nepočítaj budúce plánované (sú stále "planned" = správne)
        today = date.today().isoformat()
        query = query.lte("plan_date", today)  # len minulosť + dnes

        res = query.execute()
        data = res.data or []

        stats = {"done": 0, "postponed": 0, "missed": 0, "planned": 0}
        for row in data:
            s = row.get("status") or "planned"
            plan_date = str(row.get("plan_date") or "")

            # Kľúčová oprava: planned session v minulosti = missed
            # (status sa v DB nemení automaticky, počítame to tu)
            if s == "planned" and plan_date and plan_date < today:
                s = "missed"

            if s in stats:
                stats[s] += 1

        return stats
    except Exception as e:
        print("[DB-COACH-DAILY] stats error:", repr(e))
        return {"done": 0, "postponed": 0, "missed": 0, "planned": 0}


def db_get_postponed_sessions(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_postponed_sessions")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "postponed")
            .order("plan_date", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] get_postponed error:", repr(e))
        return []
    
def db_get_done_sessions_for_streak(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti všetky done sessiony s plan_date a duration_min.
    Používa sa pre výpočet týždenného streaku.
    """
    sb = get_sb(ctx, caller="coach_streak.db_get_done_sessions_for_streak")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("plan_date, duration_min")
            .eq("user_id", user_id)
            .eq("status", "done")
            .order("plan_date", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-STREAK] error:", repr(e))
        return []
    

# ─── Pridaj do DB/coach_plan_daily.py ────────────────────────────────────────
def db_get_done_sessions_with_activity(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Done sessiony z plánu s activity_id (pre join s activities_summary).
    Vráti: sport, duration_min, activity_id
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_done_sessions_with_activity")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("sport, duration_min, activity_id")
            .eq("user_id", user_id)
            .eq("status", "done")
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-STREAK] done_with_activity error:", repr(e))
        return []

