from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_WEEKLY


def db_insert_weekly_rows(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> int:
    """
    Bulk INSERT do coach_plan_weekly.
    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    sb = get_sb(ctx, caller="coach_plan_weekly.db_insert_weekly_rows")

    try:
        res = sb.table(TABLE_COACH_PLAN_WEEKLY).insert(rows).execute()
        data = res.data or []

        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] insert error:", repr(e))
        return 0


def db_clear_weekly_for_user_plan(
    user_id: int,
    plan_id: str,
    *,
    ctx: AuthCtx,
) -> int:
    """
    DELETE všetkých weekly riadkov daného plánu pre usera.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_clear_weekly_for_user_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .execute()
        )
        data = res.data or []

        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] clear error:", repr(e))
        return 0


def db_get_weekly_for_user_plan(
    user_id: int,
    plan_id: str,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načítanie weekly riadkov pre konkrétny plan_id.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_weekly_for_user_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("*")
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .order("week_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] get_for_plan error:", repr(e))
        return []


def db_get_week_row_for_plan(
    user_id: int,
    plan_id: str,
    week_index: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny týždeň (1 riadok) pre daný plan_id + week_index.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_week_row_for_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("*")
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .eq("week_index", week_index)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] get_week_row error:", repr(e))
        return None


def db_get_latest_plan_id_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[str]:
    """
    Vracia posledný použitý plan_id pre usera (podľa created_at).
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_latest_plan_id_for_user")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("plan_id, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        return rows[0]["plan_id"]
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] latest_plan_id error:", repr(e))
        return None
