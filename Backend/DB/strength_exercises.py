# DB/strength_exercises.py
"""Katalóg silových cvikov (tabuľka strength_exercises, Backend/sql/strength_exercises.sql)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from Modules.Supabase.client import get_sb

TABLE_STRENGTH_EXERCISES = "strength_exercises"


def db_list_strength_exercises(*, ctx: AuthCtx) -> Optional[List[Dict[str, Any]]]:
    """Všetky cviky (aj neaktívne). None = chyba – volajúci ostane pri tom, čo má."""
    sb = get_sb(ctx, caller="strength_exercises.db_list_strength_exercises")
    try:
        res = (
            sb.table(TABLE_STRENGTH_EXERCISES)
            .select("id, names, data, muscles, categories, active, sort_order, updated_at")
            .order("sort_order", desc=False)
            .limit(2000)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH-EX] list error:", repr(e))
        return None


def db_upsert_strength_exercise(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="strength_exercises.db_upsert_strength_exercise")
    try:
        res = sb.table(TABLE_STRENGTH_EXERCISES).upsert(row, on_conflict="id").execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-STRENGTH-EX] upsert error:", repr(e))
        return None
