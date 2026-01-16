from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_COACH_EXTERNAL_EVENTS

# weekday v DB berieme ako text: "Mon".."Sun"
WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}


def db_list_external_events_for_user(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Vráti všetky externé eventy pre usera.

    Pozn.: V DB je weekday ako text ("Mon".."Sun"), takže .order("weekday")
    je lexikografické. Preto to zoraď ešte server-side podľa WEEKDAY_ORDER.
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_external_events")
        res = (
            sb.table(TABLE_COACH_EXTERNAL_EVENTS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        rows = res.data or []

        rows.sort(key=lambda r: WEEKDAY_ORDER.get(str(r.get("weekday") or ""), 99))
        return rows
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] list error:", repr(e))
        return []


def db_clear_external_events_for_user(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_external_events")
        res = (
            sb.table(TABLE_COACH_EXTERNAL_EVENTS)
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


def db_insert_external_events(
    rows: List[Dict[str, Any]],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    if not rows:
        return 0

    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_external_events")
        res = sb.table(TABLE_COACH_EXTERNAL_EVENTS).insert(rows).execute()
        data = res.data or []
        print("[DB-COACH-EXT] inserted rows:", len(data))
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] insert error:", repr(e))
        return 0