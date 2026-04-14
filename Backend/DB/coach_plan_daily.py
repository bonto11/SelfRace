# DB/coach_plan_daily.py
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_DAILY

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
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update({"activity_id": activity_id, "updated_at": _now_iso()})
            .eq("id", int(id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] link_session_to_activity error:", repr(e))
        return None

def db_list_daily_for_user_horizon(user_id: int, horizon_days: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    from datetime import date, timedelta
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

# ✅ OPRAVA: Pridaný parameter `global_user_clear`. Ak je True, zmaže všetky staré plány
# pre daného usera v danom dátumovom rozmedzí`.
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
    
    
def db_has_uncompleted_daily_sessions(user_id: int, plan_date: str, *, ctx: AuthCtx) -> bool:
    """
    Vráti True, ak pre daný deň existuje aspoň jeden tréning,
    ktorý EŠTE NEMÁ priradené activity_id (t.j. nebol odtrénovaný).
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_has_uncompleted_daily_sessions")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id")
            .eq("user_id", int(user_id))
            .eq("plan_date", plan_date)
            .is_("activity_id", "null")  # Ak je null, znamená to neukončený
            .limit(1)
            .execute()
        )
        return len(res.data or []) > 0
    except Exception as e:
        print("[DB-COACH-DAILY] has_uncompleted_sessions error:", repr(e))
        return False

def db_check_daily_data_exists(user_id: int, *, ctx: AuthCtx) -> bool:
    """
    Vráti True, ak pre daný plán a používateľa existuje aspoň jeden daily záznam.
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_check_daily_data_exists")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(res.data) # Ak vráti aspoň jeden riadok, je to True
    except Exception as e:
        print("[DB-COACH-DAILY] check_exists error:", repr(e))
        return False
    
def db_delete_future_daily_plans(user_id: int, from_date: str, *, ctx: AuthCtx) -> bool:
    """
    Vymaže všetky plánované denné tréningy od zadaného dátumu (vrátane) do budúcna.
    """
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
        
def db_update_daily_session_data(user_id: int, session_id: int, update_data: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """
    Vykoná univerzálny update jedného denného tréningu.
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_update_daily_session_data")
    try:
        payload = dict(update_data)
        payload["updated_at"] = _now_iso()
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

def db_delete_daily_session(user_id: int, session_id: int, *, ctx: AuthCtx) -> bool:
    """
    Vymaže jeden konkrétny denný tréning.
    """
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
