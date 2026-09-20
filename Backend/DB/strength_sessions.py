# DB/strength_sessions.py
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

TABLE_STRENGTH_SESSIONS = "strength_sessions"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_insert_strength_session(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="strength_sessions.db_insert_strength_session")
    try:
        res = sb.table(TABLE_STRENGTH_SESSIONS).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] insert error:", repr(e))
        return None


def db_get_strength_session(
    user_id: int, session_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="strength_sessions.db_get_strength_session")
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .select("*")
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] get error:", repr(e))
        return None


def db_get_strength_session_by_plan(
    user_id: int, plan_session_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Nájde už existujúci log pre danú naplánovanú session (ak user už začal zapisovať)."""
    sb = get_sb(ctx, caller="strength_sessions.db_get_strength_session_by_plan")
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("plan_session_id", int(plan_session_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] get_by_plan error:", repr(e))
        return None


def db_get_strength_session_by_activity(
    user_id: int, activity_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="strength_sessions.db_get_strength_session_by_activity")
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("activity_id", int(activity_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] get_by_activity error:", repr(e))
        return None


def db_list_strength_sessions(
    user_id: int, *, weeks_back: int = 12, limit: int = 100, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="strength_sessions.db_list_strength_sessions")
    since = (datetime.now(timezone.utc) - timedelta(weeks=weeks_back)).date().isoformat()
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .select("*")
            .eq("user_id", int(user_id))
            .gte("session_date", since)
            .order("session_date", desc=True)
            .order("created_at", desc=True)
            .limit(int(limit))
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] list error:", repr(e))
        return []


def db_update_strength_session(
    user_id: int, session_id: int, patch: Dict[str, Any], *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="strength_sessions.db_update_strength_session")
    payload = dict(patch)
    payload["updated_at"] = _now_iso()
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .update(payload)
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] update error:", repr(e))
        return None


def db_delete_strength_session(user_id: int, session_id: int, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="strength_sessions.db_delete_strength_session")
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .delete()
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        return bool(res.data)
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] delete error:", repr(e))
        return False


def db_find_unmatched_strength_sessions_for_date(
    user_id: int, session_date: str, *, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """
    Nespárované logy (activity_id IS NULL) pre daný deň - vstup pre
    matching pri importe Strava aktivity.
    """
    sb = get_sb(ctx, caller="strength_sessions.db_find_unmatched_strength_sessions_for_date")
    try:
        res = (
            sb.table(TABLE_STRENGTH_SESSIONS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("session_date", str(session_date)[:10])
            .is_("activity_id", "null")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] find_unmatched error:", repr(e))
        return []
        
def db_list_planned_strength_sessions(
    user_id: int, *, days_back: int = 14, days_forward: int = 7, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """
    Naplánované silové session z coach_plan_daily v okolí dneška -
    zdroj pre import kostry cvikov do zápisu.
    """
    from Configs.config import TABLE_COACH_PLAN_DAILY

    sb = get_sb(ctx, caller="strength_sessions.db_list_planned_strength_sessions")
    today = datetime.now(timezone.utc).date()
    date_from = (today - timedelta(days=int(days_back))).isoformat()
    date_to = (today + timedelta(days=int(days_forward))).isoformat()

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id, plan_date, title, structure")
            .eq("user_id", int(user_id))
            .eq("sport", "strength")
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
            .order("plan_date", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH] list_planned error:", repr(e))
        return []
