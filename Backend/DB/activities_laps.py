from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_ACTIVITIES_LAPS


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_delete_laps_for_activity(
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> None:
    sb = get_sb(ctx, caller="activities_laps.db_delete_laps_for_activity")
    sb.table(TABLE_ACTIVITIES_LAPS).delete().eq("activity_id", activity_id).execute()


def db_upsert_lap(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> None:
    """
    expires_at neriešime -> DB default pri INSERT, pri UPSERT sa nemení (lebo ho neposielame).
    """
    sb = get_sb(ctx, caller="activities_laps.db_upsert_lap")
    sb.table(TABLE_ACTIVITIES_LAPS).upsert(
        row,
        on_conflict="activity_id,lap_index",
    ).execute()


def db_get_activity_laps(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Všetky laps pre danú aktivitu – iba platné:
      - deleted_at IS NULL
      - expires_at > now()
    """
    sb = get_sb(ctx, caller="activities_laps.db_get_activity_laps")
    now = _now_iso()

    res = (
        sb.table(TABLE_ACTIVITIES_LAPS)
        .select("*")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .is_("deleted_at", "null")
        .gt("expires_at", now)
        .order("lap_index", desc=False)
        .execute()
    )
    return res.data or []


def db_get_activity_laps_batch(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> Dict[int, List[Dict[str, Any]]]:
    """
    Načíta laps pre viacero aktivít naraz — jeden DB call namiesto N.
    Vracia {activity_id: [rows]} zoradené podľa lap_index.
    Iba platné záznamy: deleted_at IS NULL, expires_at > now().
    """
    if not activity_ids:
        return {}

    sb = get_sb(ctx, caller="activities_laps.db_get_activity_laps_batch")
    now = _now_iso()

    res = (
        sb.table(TABLE_ACTIVITIES_LAPS)
        .select("*")
        .eq("user_id", user_id)
        .in_("activity_id", activity_ids)
        .is_("deleted_at", "null")
        .gt("expires_at", now)
        .order("lap_index", desc=False)
        .execute()
    )

    # Zoskupíme riadky podľa activity_id — poradie lap_index je zachované z DB
    result: Dict[int, List[Dict[str, Any]]] = {}
    for row in res.data or []:
        aid = row.get("activity_id")
        if aid is None:
            continue
        try:
            aid = int(aid)
        except Exception:
            continue
        result.setdefault(aid, []).append(row)

    return result