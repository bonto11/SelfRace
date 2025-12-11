# Routes_DB/coach_external_events.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_EXTERNAL_EVENTS

supabase = get_client()


def db_list_external_events_for_user(user_id: int) -> List[Dict[str, Any]]:
    """
    Vráti všetky externé eventy pre daného usera, zoradené podľa weekday a created_at.
    """
    try:
        res = (
            supabase.table(TABLE_COACH_EXTERNAL_EVENTS)
            .select("*")
            .eq("user_id", user_id)
            .order("weekday", desc=False)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] list error:", repr(e))
        return []


def db_clear_external_events_for_user(user_id: int) -> int:
    """
    Zmaže všetky externé eventy pre daného usera.
    Používame pri "overwrite" save.
    """
    try:
        res = (
            supabase.table(TABLE_COACH_EXTERNAL_EVENTS)
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        print("[DB-COACH-EXT] clear user=%s deleted=%s", user_id, len(rows))
        return len(rows)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] clear error:", repr(e))
        return 0


def db_insert_external_events(rows: List[Dict[str, Any]]) -> int:
    """
    Bulk INSERT externých eventov.
    """
    if not rows:
        return 0

    try:
        res = supabase.table(TABLE_COACH_EXTERNAL_EVENTS).insert(rows).execute()
        data = res.data or []
        print("[DB-COACH-EXT] inserted rows:", len(data))
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] insert error:", repr(e))
        return 0