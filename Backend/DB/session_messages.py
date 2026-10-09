# DB/session_messages.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_SESSION_MESSAGES

# Tabuľka nemá RLS policies (sql/session_messages.sql) – volá sa len so
# service ctx. Kto smie čítať/písať, overuje Services/session_messages.py.

_COLS = "id, athlete_user_id, link_id, daily_plan_id, activity_id, author_user_id, body, created_at, read_at"


def _thread(q, *, plan_id: Optional[int], activity_id: Optional[int]):
    if plan_id is not None:
        return q.eq("daily_plan_id", int(plan_id))
    return q.eq("activity_id", int(activity_id))  # type: ignore[arg-type]


def db_list_thread_messages(
    athlete_user_id: int,
    *,
    plan_id: Optional[int],
    activity_id: Optional[int],
    link_id: Optional[int] = None,
    limit: int = 200,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Správy vlákna od najstaršej. link_id = len správy z tejto spolupráce."""
    sb = get_sb(ctx, caller="session_messages.db_list_thread_messages")
    q = sb.table(TABLE_SESSION_MESSAGES).select(_COLS).eq("athlete_user_id", int(athlete_user_id))
    q = _thread(q, plan_id=plan_id, activity_id=activity_id)
    if link_id is not None:
        q = q.eq("link_id", int(link_id))
    res = q.order("created_at", desc=False).limit(int(limit)).execute()
    return list(res.data or [])


def db_insert_message(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="session_messages.db_insert_message")
    res = sb.table(TABLE_SESSION_MESSAGES).insert(row).execute()
    return (res.data or [None])[0]


def db_mark_thread_read(
    athlete_user_id: int,
    *,
    plan_id: Optional[int],
    activity_id: Optional[int],
    reader_user_id: int,
    link_id: Optional[int] = None,
    ctx: AuthCtx,
) -> None:
    """Označí ako prečítané správy vlákna, ktoré napísal niekto iný ako čitateľ."""
    sb = get_sb(ctx, caller="session_messages.db_mark_thread_read")
    q = (
        sb.table(TABLE_SESSION_MESSAGES)
        .update({"read_at": datetime.now(timezone.utc).isoformat()})
        .eq("athlete_user_id", int(athlete_user_id))
        .neq("author_user_id", int(reader_user_id))
        .is_("read_at", None)
    )
    q = _thread(q, plan_id=plan_id, activity_id=activity_id)
    if link_id is not None:
        q = q.eq("link_id", int(link_id))
    q.execute()


def db_list_unread_for_reader(
    athlete_user_id: int,
    *,
    reader_user_id: int,
    link_id: Optional[int] = None,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Neprečítané správy pre čitateľa (len ciele vlákien – na bodky v UI)."""
    sb = get_sb(ctx, caller="session_messages.db_list_unread_for_reader")
    q = (
        sb.table(TABLE_SESSION_MESSAGES)
        .select("daily_plan_id, activity_id, created_at")
        .eq("athlete_user_id", int(athlete_user_id))
        .neq("author_user_id", int(reader_user_id))
        .is_("read_at", None)
    )
    if link_id is not None:
        q = q.eq("link_id", int(link_id))
    res = q.limit(500).execute()
    return list(res.data or [])
