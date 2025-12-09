# Routes_DB/coach_plan_meta.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLAN_META

supabase = get_client()


def db_insert_plan_meta_generated(
    *,
    user_id: int,
    plan_id: str,
    state_id: Optional[int],
    weeks_total: Optional[int],
    start_date: Optional[str],
    end_date: Optional[str],
    main_sport: Optional[str],
    goal_kind: Optional[str],
    source: Optional[str] = "ai_weekly_v1",
) -> Optional[Dict[str, Any]]:
    """
    Vloží riadok do coach_plan_meta so status='generated'.
    """
    row = {
        "user_id": user_id,
        "plan_id": plan_id,
        "status": "generated",
        "state_id": state_id,
        "weeks_total": weeks_total,
        "start_date": start_date,
        "end_date": end_date,
        "main_sport": main_sport,
        "goal_kind": goal_kind,
        "source": source,
    }
    print("[DB-COACH-META] row:", row)
    try:
        res = supabase.table(TABLE_COACH_PLAN_META).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] insert_generated error:", repr(e))
        return None


def db_archive_user_plans(
    user_id: int,
    *,
    statuses: Optional[List[str]] = None,
) -> int:
    """
    Nastaví status='archived' pre všetky meta plány usera
    s daným statusom (default: generated + active).
    """
    st = statuses or ["generated", "active"]

    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_META)
            .update({"status": "archived"})
            .eq("user_id", user_id)
            .in_("status", st)
            .execute()
        )
        rows = res.data or []
        print(
            "[DB-COACH-META] archived plans user=%s count=%s",
            user_id,
            len(rows),
        )
        return len(rows)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-META] archive_user_plans error:", repr(e))
        return 0


def db_get_latest_plan_meta_for_user(
    user_id: int,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší meta záznam (bez ohľadu na status).
    Použiteľné na zistenie last plan_id.
    """
    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_META)
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
) -> Optional[Dict[str, Any]]:
    """
    Vráti aktuálne aktívny plán (status='active'), alebo None.
    """
    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_META)
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
) -> Optional[Dict[str, Any]]:
    """
    Zmení status konkrétneho plánu (napr. generated → active alebo → cancelled).
    """
    try:
        res = (
            supabase.table(TABLE_COACH_PLAN_META)
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
    

    