from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_STRENGTH_HISTORY


def db_insert_strength_history_rows(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> int:
    """
    Bulk INSERT do coach_strength_history.
    """
    if not rows:
        return 0

    sb = get_sb(ctx, caller="coach_strength_history.db_insert_weekly_rows")

    # pre istotu normalizuj session_date na string
    normalized: List[Dict[str, Any]] = []
    for r in rows:
        r2 = dict(r)
        sd = r2.get("session_date")
        if isinstance(sd, date):
            r2["session_date"] = sd.isoformat()
        normalized.append(r2)

    try:
        res = sb.table(TABLE_COACH_STRENGTH_HISTORY).insert(normalized).execute()
        data = res.data or []
        print("[DB-COACH-STRENGTH] inserted rows:", len(data))
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-STRENGTH] insert error:", repr(e))
        return 0


def db_get_strength_history_for_user(
    user_id: int,
    *,
    weeks_back: int = 8,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načíta históriu silových cvikov pre usera za posledných weeks_back týždňov.
    """
    sb = get_sb(ctx, caller="coach_strength_history.db_get_strength_history_for_user")

    today = date.today()
    start_date = today - timedelta(weeks=weeks_back)

    try:
        res = (
            sb.table(TABLE_COACH_STRENGTH_HISTORY)
            .select("*")
            .eq("user_id", user_id)
            .gte("session_date", start_date.isoformat())
            .order("session_date", desc=True)
            .order("id", desc=True)
            .execute()
        )
        data = res.data or []
        print(
            "[DB-COACH-STRENGTH] history user=%s weeks_back=%s rows=%s",
            user_id,
            weeks_back,
            len(data),
        )
        return data
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-STRENGTH] history error:", repr(e))
        return []
