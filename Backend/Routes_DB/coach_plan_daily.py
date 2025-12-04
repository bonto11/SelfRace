# Routes_DB/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, List

from Modules.SQL.db_handler import get_client

supabase = get_client()
TABLE = "coach_plan_daily"


def db_insert_daily_rows(
    rows: List[Dict[str, Any]],
    table_name: str = TABLE,
) -> int:
    """
    Bulk INSERT do coach_plan_daily.
    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    try:
        res = supabase.table(table_name).insert(rows).execute()
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
    table_name: str = TABLE,
) -> int:
    """
    DELETE všetkých daily riadkov pre daný plán + týždeň (interval dátumov).
    """
    try:
        res = (
            supabase.table(table_name)
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