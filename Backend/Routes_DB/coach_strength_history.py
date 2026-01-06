from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_COACH_STRENGTH_HISTORY


def _get_sb(
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
):
    """
    - user_jwt != None → RLS klient
    - service=True     → service klient
    """
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    if service:
        return get_service_client()
    raise RuntimeError(
        "coach_strength_history: missing user_jwt or service=True in DB helper"
    )


def db_insert_strength_history_rows(
    rows: List[Dict[str, Any]],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    """
    Bulk INSERT do coach_strength_history.
    """
    if not rows:
        return 0

    sb = _get_sb(user_jwt=user_jwt, service=service)

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
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Načíta históriu silových cvikov pre usera za posledných weeks_back týždňov.
    """
    sb = _get_sb(user_jwt=user_jwt, service=service)

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