# Routes_DB/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLAN_WEEKLY


def db_insert_weekly_rows(
    rows: List[Dict[str, Any]],
    *,
    user_jwt: str,
) -> int:
    """
    Bulk INSERT do coach_plan_weekly cez RLS (user_jwt).
    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    sb = get_client(user_jwt=user_jwt)

    try:
        res = sb.table(TABLE_COACH_PLAN_WEEKLY).insert(rows).execute()
        data = res.data or []
        print("[DB-COACH-WEEKLY] inserted rows:", len(data))
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] insert error:", repr(e))
        return 0


def db_clear_weekly_for_user_plan(
    user_id: int,
    plan_id: str,
    *,
    user_jwt: str,
) -> int:
    """
    DELETE všetkých weekly riadkov daného plánu pre usera (cez RLS).
    """
    sb = get_client(user_jwt=user_jwt)

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .execute()
        )
        data = res.data or []
        print(
            "[DB-COACH-WEEKLY] clear user=%s plan_id=%s deleted=%s",
            user_id,
            plan_id,
            len(data),
        )
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] clear error:", repr(e))
        return 0


def db_get_weekly_for_user_plan(
    user_id: int,
    plan_id: str,
    *,
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Načítanie weekly riadkov pre konkrétny plan_id (cez RLS).
    """
    sb = get_client(user_jwt=user_jwt)

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
    user_jwt: str,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny týždeň (1 riadok) pre daný plan_id + week_index.
    Vhodné pre daily generátor, ak chceš z weekly zistiť week_start/week_end.
    """
    sb = get_client(user_jwt=user_jwt)

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
    user_jwt: str,
) -> Optional[str]:
    """
    Vracia posledný použitý plan_id pre usera (podľa created_at, cez RLS).
    """
    sb = get_client(user_jwt=user_jwt)

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