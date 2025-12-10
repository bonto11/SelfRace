# Routes_DB/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date, timedelta

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLAN_DAILY

supabase = get_client()


def db_insert_daily_rows(
    rows: List[Dict[str, Any]],
) -> int:
    """
    Bulk INSERT do coach_plan_daily.
    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    try:
        res = supabase.table(TABLE_COACH_PLAN_DAILY).insert(rows).execute()
        data = res.data or []
        print("[DB-COACH-DAILY] inserted rows:", len(data))
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] insert error:", repr(e))
        return 0


def db_clear_daily_for_user_week(
    user_id: int,
    plan_id: str,
    week_start: str,
    week_end: str,
) -> int:
    """
    DELETE všetkých daily riadkov pre daný plán + týždeň (interval dátumov).
    """
    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .gte("plan_date", week_start)
            .lte("plan_date", week_end)
            .execute()
        )
        data = res.data or []
        print(
            "[DB-COACH-DAILY] clear user=%s plan_id=%s week=%s..%s deleted=%s",
            user_id,
            plan_id,
            week_start,
            week_end,
            len(data),
        )
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] clear error:", repr(e))
        return 0


# ---------------------------------------------------------------------------
#  DVE FUNKCIE, KTORÉ POUŽÍVA plan_activity_match.py
# ---------------------------------------------------------------------------

def db_get_planned_range_rows(
    user_id: int,
    date_from: str,
    date_to: str,
) -> List[Dict[str, Any]]:
    """
    Načíta všetky plánované sessions pre usera v danom dátumovom rozsahu.

    Používa sa v Services/plan_activity_match.py na porovnanie plánu s aktivitami.
    """
    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_DAILY)
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
    user_id: int,
    session_id: int,
    activity_id: Optional[int],
) -> Optional[Dict[str, Any]]:
    """
    Napojí jednu plánovanú session (coach_plan_daily.id) na konkrétnu aktivitu
    v tabuľke activities_summary (alebo podobnej) – zapíše activity_id.

    Vracia aktualizovaný riadok, alebo None pri chybe.
    """
    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_DAILY)
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
    plan_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Načíta všetky daily plánované sessions pre usera
    od dneška po dnes + horizon_days.

    Ak je zadaný plan_id, filtruje len daný plán (active / latest),
    inak vráti všetky plány usera.
    Používa sa v service_get_daily_overview.
    """
    if horizon_days <= 0:
        horizon_days = 7

    today = date.today()
    end_date = today + timedelta(days=horizon_days)

    date_from = today.isoformat()  # "YYYY-MM-DD"
    date_to = end_date.isoformat()  # "YYYY-MM-DD"

    try:
        query = (
            supabase.table(TABLE_COACH_PLAN_DAILY)
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