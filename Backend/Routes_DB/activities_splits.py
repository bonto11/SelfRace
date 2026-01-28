from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_SPLITS


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_delete_splits_for_activity(
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_splits")
    sb.table(TABLE_ACTIVITIES_SPLITS).delete().eq("activity_id", activity_id).execute()


def db_upsert_split(
    row: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    expires_at neriešime -> DB default pri INSERT, pri UPSERT sa nemení (lebo ho neposielame).
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_splits")
    sb.table(TABLE_ACTIVITIES_SPLITS).upsert(
        row,
        on_conflict="activity_id,split_index",
    ).execute()


def db_get_activity_splits(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Všetky splits pre danú aktivitu daného usera – iba platné:
      - deleted_at IS NULL
      - expires_at > now()
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_splits")
    now = _now_iso()

    res = (
        sb.table(TABLE_ACTIVITIES_SPLITS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .is_("deleted_at", "null")
        .gt("expires_at", now)
        .order("split_index", desc=False)
        .execute()
    )
    return res.data or []