# Modules/Intervals/db.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Intervals.config import MAX_ERROR_LEN, TABLE_INTERVALS_ACCOUNTS
from Modules.Supabase.auth import service_ctx
from Modules.Supabase.client import get_sb

# PREČO vždy service ctx: tabuľka drží API kľúč, preto na ňu user (RLS)
# nemá žiadny prístup – ani na čítanie. FE sa pýta len cez /status,
# ktorý vráti bool, nikdy kľúč.
_CTX = service_ctx("intervals.db")


def db_intervals_get_account(user_id: int) -> Optional[Dict[str, Any]]:
    sb = get_sb(_CTX, caller="intervals.db_intervals_get_account")
    res = (
        sb.table(TABLE_INTERVALS_ACCOUNTS)
        .select("user_id, athlete_id, api_key")
        .eq("user_id", int(user_id))
        .eq("enabled", True)
        .limit(1)
        .execute()
    )
    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else None


def db_intervals_list_enabled_user_ids() -> List[int]:
    sb = get_sb(_CTX, caller="intervals.db_intervals_list_enabled_user_ids")
    res = (
        sb.table(TABLE_INTERVALS_ACCOUNTS)
        .select("user_id")
        .eq("enabled", True)
        .execute()
    )
    return sorted(int(r["user_id"]) for r in (res.data or []) if r.get("user_id"))


def db_intervals_mark_sync(user_id: int, error: Optional[str]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    patch: Dict[str, Any] = {"updated_at": now, "last_error": None}
    if error:
        patch["last_error"] = error[:MAX_ERROR_LEN]
    else:
        patch["last_synced_at"] = now

    sb = get_sb(_CTX, caller="intervals.db_intervals_mark_sync")
    sb.table(TABLE_INTERVALS_ACCOUNTS).update(patch).eq("user_id", int(user_id)).execute()
