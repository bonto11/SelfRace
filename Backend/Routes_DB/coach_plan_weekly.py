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
            .execute()
        )
        data = res.data or []

        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] clear error:", repr(e))
        return 0


def db_get_weekly_for_user_plan(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načítanie weekly riadkov pre konkrétny.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_weekly_for_user_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("*")
            .eq("user_id", user_id)
            .order("week_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] get_for_plan error:", repr(e))
        return []


def db_get_week_row_for_plan(
    user_id: int,
    week_index: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny týždeň (1 riadok) + week_index.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_week_row_for_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("*")
            .eq("user_id", user_id)
            .eq("week_index", week_index)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] get_week_row error:", repr(e))
        return None

def db_check_weekly_data_exists(user_id: int, *, ctx: AuthCtx) -> bool:
    """
    Vráti True, ak pre daný plán a používateľa existuje aspoň jeden weekly záznam.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_check_weekly_data_exists")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(res.data) # Ak vráti aspoň jeden riadok, je to True
    except Exception as e:
        print("[DB-COACH-WEEKLY] check_exists error:", repr(e))
        return False

def db_get_weekly_row_by_date(
    user_id: int, 
    target_date_iso: str, 
    *, 
    ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """
    Nájde weekly riadok, do ktorého patrí zadaný dátum (medzi week_start a week_end).
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_weekly_row_by_date")
    date_only = target_date_iso[:10]
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("id, week_start, week_end, week_index")
            .eq("user_id", user_id)
            .lte("week_start", date_only)
            .gte("week_end", date_only)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as e:
        print("[DB-COACH-WEEKLY] get_row_by_date error:", repr(e))
        return None

def db_update_weekly_actual_stats(
    row_id: int, 
    actual_stats: Dict[str, Any], 
    *, 
    ctx: AuthCtx
) -> bool:
    """
    Zaktualizuje JSONB stĺpec 'actual_stats' pre konkrétny weekly riadok.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_update_weekly_actual_stats")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .update({"actual_stats": actual_stats})
            .eq("id", row_id)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-WEEKLY] update_actual_stats error:", repr(e))
        return False

# Tú starú funkciu db_update_weekly_completed_km môžeš kľudne zmazať, už ju nebudeme potrebovať.