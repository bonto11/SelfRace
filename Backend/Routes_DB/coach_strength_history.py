# Routes_DB/coach_strength_history.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List

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
    Očakáva zoznam dictov obsahujúcich: user_id, session_date, plan_id, session_index, slot, exercise_id
    """
    if not rows:
        return 0

    sb = get_sb(ctx, caller="coach_strength_history.db_insert_strength_history_rows")

    # Normalizácia dátumov na ISO string, aby s tým Supabase nemal problém
    normalized: List[Dict[str, Any]] = []
    for r in rows:
        r2 = dict(r)
        sd = r2.get("session_date")
        if isinstance(sd, date):
            r2["session_date"] = sd.isoformat()
        normalized.append(r2)

    try:
        res = sb.table(TABLE_COACH_STRENGTH_HISTORY).insert(normalized).execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-STRENGTH] insert history error:", repr(e))
        return 0


def db_get_strength_history_for_user(
    user_id: int,
    *,
    weeks_back: int = 4,  # Default na 4 týždne (ideálne okno pre silový blok)
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načíta históriu silových cvikov pre usera za posledných X týždňov.
    """
    sb = get_sb(ctx, caller="coach_strength_history.db_get_strength_history_for_user")

    start_date = date.today() - timedelta(weeks=weeks_back)

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
        return res.data or []
    except Exception as e:
        print("[DB-COACH-STRENGTH] get history error:", repr(e))
        return []