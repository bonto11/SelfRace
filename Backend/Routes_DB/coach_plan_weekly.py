# Routes_DB/coach_plan_weekly.py

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLAN_WEEKLY

supabase = get_client()

def db_insert_weekly_rows(rows: List[Dict[str, Any]]) -> int:
    """
    Vloží viac riadkov do coach_plan_weekly.
    Vráti počet vložených riadkov.
    """

    print("db_insert_weekly_rows rows",rows)
    if not rows:
        return 0

    res = supabase.table(TABLE_COACH_PLAN_WEEKLY).insert(rows).execute()
    data = res.data or []
    print(
        f"[DB-COACH-PLAN-WEEKLY] insert_weekly_rows count={len(rows)} "
        f"db_returned={len(data)}"
    )
    return len(data)

def db_clear_weekly_for_user_plan(
    user_id: int,
    plan_id: Optional[str] = None,
) -> int:
    """
    Zmaže weekly riadky:
      - ak plan_id → len daný plán,
      - inak všetko pre usera (teoreticky).
    Použiteľné pri zrušení plánu.
    """
    q = (
        supabase.table(TABLE_COACH_PLAN_WEEKLY)
        .delete()
        .eq("user_id", user_id)
    )
    if plan_id:
        q = q.eq("plan_id", plan_id)

    res = q.execute()
    rows = res.data or []
    deleted = len(rows)
    print(
        f"[DB-COACH-PLAN-WEEKLY] clear_weekly_for_user_plan user={user_id} "
        f"plan_id={plan_id} deleted={deleted}"
    )
    return deleted


def db_get_weekly_for_plan(
    user_id: int,
    plan_id: str,
) -> List[Dict[str, Any]]:
    """
    Načíta všetky weekly riadky pre daný plán (do budúcna pre continue/debug).
    """
    res = (
        supabase.table(TABLE_COACH_PLAN_WEEKLY)
        .select("*")
        .eq("user_id", user_id)
        .eq("plan_id", plan_id)
        .order("week_index", desc=False)
        .execute()
    )
    data = res.data or []
    print(
        f"[DB-COACH-PLAN-WEEKLY] get_weekly_for_plan user={user_id} "
        f"plan_id={plan_id} rows={len(data)}"
    )
    return data