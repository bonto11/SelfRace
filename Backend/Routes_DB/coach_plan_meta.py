from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_META


def db_insert_plan_meta_generated(
    *,
    user_id: int,
    plan_id: str,
    base_state_id: Optional[int],
    weeks_total: Optional[int],
    start_date: Optional[str],
    end_date: Optional[str],
    main_sport: Optional[str],
    goal_kind: Optional[str],
    source: Optional[str] = "ai_weekly_v1",
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vloží riadok do coach_plan_meta so status='generated'.
    """
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")

    row = {
        "user_id": user_id,
        "plan_id": plan_id,
        "status": "generated",
        "base_state_id": base_state_id,
        "weeks_total": weeks_total,
        "start_date": start_date,
        "end_date": end_date,
        "main_sport": main_sport,
        "goal_kind": goal_kind,
        "source": source,
    }

    try:
        res = sb.table(TABLE_COACH_PLAN_META).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] insert_generated error:", repr(e))
        return None


def db_archive_user_plans(
    user_id: int,
    *,
    ctx: AuthCtx,
    statuses: Optional[List[str]] = None,
) -> int:
    """
    Nastaví status='archived' pre všetky meta plány usera
    s daným statusom (default: generated + active).
    """
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")

    st = statuses or ["generated", "active"]

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .update({"status": "archived"})
            .eq("user_id", user_id)
            .in_("status", st)
            .execute()
        )
        rows = res.data or []

        return len(rows)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] archive_user_plans error:", repr(e))
        return 0


def db_get_latest_plan_meta_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší meta záznam (bez ohľadu na status).
    Použiteľné na zistenie last plan_id.
    """
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] latest_plan_meta error:", repr(e))
        return None


def db_get_active_plan_meta_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti aktuálne aktívny plán (status='active'), alebo None.
    """
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] active_plan_meta error:", repr(e))
        return None


def db_update_plan_status(
    user_id: int,
    plan_id: str,
    new_status: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Zmení status konkrétneho plánu (napr. generated → active alebo → cancelled).
    """
    sb = get_sb(ctx, caller="coach_plan_meta.db_insert_daily_rows")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .update({"status": new_status})
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] update_plan_status error:", repr(e))
        return None

def db_delete_plan_meta(user_id: int, plan_id: str, *, ctx: AuthCtx) -> bool:
    """
    Tvrdé zmazanie meta záznamu z databázy. Žiadna archivácia.
    """
    sb = get_sb(ctx, caller="coach_plan_meta.db_delete_plan_meta")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_META)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .execute()
        )
        return True
    except Exception as e:
        print("[DB-COACH-META] delete_plan_meta error:", repr(e))
        return False