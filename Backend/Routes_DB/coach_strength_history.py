# Routes_DB/coach_strength_history.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_STRENGTH_HISTORY


def db_insert_strength_history_rows(
    rows: List[Dict[str, Any]],
    *,
    user_jwt: str,
) -> int:
    """
    Bulk INSERT do coach_strength_history (RLS, cez user JWT).

    Očakávaný input:
      rows = [
        {
          "user_id": int,
          "session_date": "YYYY-MM-DD" alebo date,
          "plan_id": Optional[uuid],
          "session_index": int,
          "slot": str,          # napr. "lower_quad", "core", ...
          "exercise_id": str,   # konkrétny cvik z nášho katalógu, napr. "split_squat"
        },
        ...
      ]

    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    sb = get_client(user_jwt=user_jwt)

    # pre istotu normalizuj session_date na string (Supabase si s date poradí,
    # ale nech to máme konzistentné)
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
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Načíta históriu silových cvikov pre usera za posledných weeks_back týždňov (RLS).

    Výstup je list dictov:
      {
        "id": int,
        "user_id": int,
        "session_date": "YYYY-MM-DD",
        "plan_id": Optional[str],
        "session_index": int,
        "slot": str,          # napr. "lower_quad"
        "exercise_id": str,   # napr. "split_squat"
        "created_at": "timestamp",
      }
    """
    sb = get_client(user_jwt=user_jwt)

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