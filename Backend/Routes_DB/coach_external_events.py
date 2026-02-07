from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_EXTERNAL_EVENTS


# 1=Mon..7=Sun
def _wk(v: Any) -> int:
    try:
        n = int(v)
        return n if 1 <= n <= 7 else 99
    except Exception:  # noqa: BLE001
        return 99


def db_list_external_events_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti všetky externé eventy pre usera.
    Triedi primárne podľa weekday_int (1..7), potom created_at.
    """
    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_list_external_events_for_user"
        )

        res = (
            sb.table(TABLE_COACH_EXTERNAL_EVENTS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        rows = res.data or []

        # stable sort: weekday_int then created_at
        rows.sort(
            key=lambda r: (_wk(r.get("weekday_int")), str(r.get("created_at") or ""))
        )
        return rows
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] list error:", repr(e))
        return []


def db_clear_external_events_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> int:
    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_list_external_events_for_user"
        )

        res = (
            sb.table(TABLE_COACH_EXTERNAL_EVENTS)
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []

        return len(rows)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] clear error:", repr(e))
        return 0


def db_insert_external_events(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> int:
    if not rows:
        return 0

    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_list_external_events_for_user"
        )

        res = sb.table(TABLE_COACH_EXTERNAL_EVENTS).insert(rows).execute()
        data = res.data or []

        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] insert error:", repr(e))
        return 0
