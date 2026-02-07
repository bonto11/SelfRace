from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date, timedelta,datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_DAILY

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def db_insert_daily_rows(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> int:
    """
    Bulk INSERT do coach_plan_daily.
    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    sb = get_sb(ctx, caller="coach_plan_daily.db_insert_daily_rows")

    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).insert(rows).execute()
        data = res.data or []
  
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] insert error:", repr(e))
        return 0


def db_clear_daily_for_user_week(
    user_id: int,
    plan_id: str,
    week_start: str,
    week_end: str,
    *,
    ctx: AuthCtx,
) -> int:
    """
    DELETE všetkých daily riadkov pre daný plán + týždeň (interval dátumov).
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_week")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .gte("plan_date", week_start)
            .lte("plan_date", week_end)
            .execute()
        )
        data = res.data or []

        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] clear error:", repr(e))
        return 0


# ---------------------------------------------------------------------------
#  FUNKCIE, KTORÉ POUŽÍVA plan_activity_match.py
# ---------------------------------------------------------------------------


def db_get_planned_range_rows(
    user_id: int,
    date_from: str,
    date_to: str,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načíta všetky plánované sessions pre usera v danom dátumovom rozsahu.
    """
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
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] get_planned_range_rows error:", repr(e))
        return []


def db_link_session_to_activity(
    user_id:int,
    ctx: AuthCtx,
    session_id: int,
        *,
    activity_id: Optional[int],
) -> Optional[Dict[str, Any]]:
    """
    Napojí jednu plánovanú session (coach_plan_daily.id) na konkrétnu aktivitu
    – zapíše activity_id.
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_link_session_to_activity")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update({"activity_id": activity_id})
            .eq("id", session_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] link_session_to_activity error:", repr(e))
        return None


def db_list_daily_for_user_horizon(
    user_id: int,
    horizon_days: int,
    *,
    ctx: AuthCtx,
    plan_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Načíta všetky daily plánované sessions pre usera
    od dneška po dnes + horizon_days.
    """
    if horizon_days <= 0:
        horizon_days = 7

    today = date.today()
    end_date = today + timedelta(days=horizon_days)

    date_from = today.isoformat()
    date_to = end_date.isoformat()

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

        if plan_id:
            query = query.eq("plan_id", plan_id)

        res = query.execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] db_list_daily_for_user_horizon error:", repr(e))
        return []


def db_clear_daily_for_user_plan(
    user_id: int,
    plan_id: str,
    *,
    ctx: AuthCtx,
) -> int:
    """
    Delete všetkých daily riadkov pre daný plán (bez ohľadu na dátum).
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .execute()
        )
        data = res.data or []
        print(
            "[DB-COACH-DAILY] clear plan user=%s plan_id=%s deleted=%s",
            user_id,
            plan_id,
            len(data),
        )
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] clear_plan error:", repr(e))
        return 0


def db_clear_daily_for_user_range(
    user_id: int,
    plan_id: str,
    date_from: str,
    date_to: str,
    *,
    ctx: AuthCtx,
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_range")

    res = (
        sb.table(TABLE_COACH_PLAN_DAILY)
        .delete()
        .eq("user_id", user_id)
        .eq("plan_id", plan_id)
        .gte("plan_date", date_from)
        .lte("plan_date", date_to)
        .execute()
    )

    return len(res.data or [])
    

def db_get_daily_session_by_id(
    user_id: int,
    session_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_daily_session_by_id")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id,user_id,plan_id,plan_date,session_index")
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] get_session_by_id error:", repr(e))
        return None


def db_count_sessions_on_day(
    user_id: int,
    plan_id: str,
    plan_date: str,
    *,
    ctx: AuthCtx,
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_count_sessions_on_day")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id")
            .eq("user_id", int(user_id))
            .eq("plan_id", str(plan_id))
            .eq("plan_date", str(plan_date))
            .execute()
        )
        return len(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] count_sessions_on_day error:", repr(e))
        return 0


def db_get_max_session_index_on_day(
    user_id: int,
    plan_id: str,
    plan_date: str,
    *,
    ctx: AuthCtx,
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_max_session_index_on_day")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("session_index")
            .eq("user_id", int(user_id))
            .eq("plan_id", str(plan_id))
            .eq("plan_date", str(plan_date))
            .order("session_index", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return -1
        v = rows[0].get("session_index")
        return int(v) if isinstance(v, int) else int(v or 0)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] max_session_index_on_day error:", repr(e))
        return -1


def db_update_daily_session_date(
    user_id: int,
    session_id: int,
    *,
    plan_date: str,
    session_index: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_update_daily_session_date")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update(
                {
                    "plan_date": str(plan_date),
                    "session_index": int(session_index),
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] update_daily_session_date error:", repr(e))
        return None


def db_reschedule_daily_sessions_bulk(
    user_id: int,
    *,
    moves: List[Dict[str, Any]],
    max_per_day: int = 2,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Bulk reschedule:
      - každá move: {session_id, from_date, to_date}
      - overí existenciu a user ownership
      - overí max_per_day na cieľový deň
      - nastaví session_index na koniec cieľového dňa
    """
    if not moves:
        return {"ok": True, "updated": 0}

    updated = 0
    errors: List[Dict[str, Any]] = []

    for m in moves:
        try:
            sid = int(m.get("session_id"))
            from_date = str(m.get("from_date") or "")[:10]
            to_date = str(m.get("to_date") or "")[:10]

            if not sid or not to_date:
                raise ValueError("missing session_id/to_date")

            row = db_get_daily_session_by_id(user_id=user_id, session_id=sid, ctx=ctx)
            if not row:
                raise ValueError("session_not_found_or_not_owned")

            plan_id = row.get("plan_id")
            if not isinstance(plan_id, str) or not plan_id:
                raise ValueError("session_has_no_plan_id")

            current_date = str(row.get("plan_date") or "")[:10]

            # optional sanity: from_date mismatch = allow, ale vieš to logovať
            if from_date and current_date and from_date != current_date:
                # neblokujem, len je to info (FE mohlo mať stale data)
                pass

            if to_date == current_date:
                continue  # nič sa nemení

            # enforce max_per_day (počítame aktuálny stav DB)
            cnt = db_count_sessions_on_day(
                user_id=user_id,
                plan_id=plan_id,
                plan_date=to_date,
                ctx=ctx,
            )
            if cnt >= int(max_per_day or 2):
                raise ValueError("target_day_full")

            # append na koniec dňa
            max_idx = db_get_max_session_index_on_day(
                user_id=user_id,
                plan_id=plan_id,
                plan_date=to_date,
                ctx=ctx,
            )
            next_idx = int(max_idx + 1)

            upd = db_update_daily_session_date(
                user_id=user_id,
                session_id=sid,
                plan_date=to_date,
                session_index=next_idx,
                ctx=ctx,
            )
            if not upd:
                raise ValueError("update_failed")

            updated += 1

        except Exception as e:  # noqa: BLE001
            errors.append(
                {
                    "session_id": m.get("session_id"),
                    "error": str(e),
                }
            )

    if errors:
        # keď chceš striktne: return ok=False a nič neupdateovať → potrebuješ RPC/transaction
        # zatiaľ: best-effort, ale FE uvidí error a môže refreshnúť
        return {"ok": False, "updated": updated, "error": "some_moves_failed", "errors": errors}

    return {"ok": True, "updated": updated}
