# DB/exercise_suggestions.py
"""
Návrhy cvikov od userov na doplnenie do STRENGTH_EXERCISE_CATALOG.

Zber podnetov, nie živý katalóg - schválený návrh pridávaš ručne do
Configs/strength_catalog.py a Configs/strength_muscles.py.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

TABLE_EXERCISE_SUGGESTIONS = "exercise_suggestions"


def db_insert_exercise_suggestion(
    row: Dict[str, Any], *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Vloží nový návrh cviku. Vracia vložený riadok alebo None pri zlyhaní."""
    sb = get_sb(ctx, caller="exercise_suggestions.db_insert_exercise_suggestion")
    try:
        res = sb.table(TABLE_EXERCISE_SUGGESTIONS).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-EX-SUGGEST] insert error:", repr(e))
        return None


def db_list_exercise_suggestions_for_user(
    user_id: int, *, limit: int = 50, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """Návrhy jedného usera, najnovšie prvé."""
    sb = get_sb(ctx, caller="exercise_suggestions.db_list_exercise_suggestions_for_user")
    try:
        res = (
            sb.table(TABLE_EXERCISE_SUGGESTIONS)
            .select("*")
            .eq("user_id", int(user_id))
            .order("created_at", desc=True)
            .limit(int(limit))
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-EX-SUGGEST] list error:", repr(e))
        return []


def db_list_all_exercise_suggestions(
    *, status: Optional[str] = None, limit: int = 200, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """
    Všetky návrhy naprieč usermi - pre admin prehľad, čo treba doplniť
    do katalógu. status: new | approved | rejected (None = všetky).
    """
    sb = get_sb(ctx, caller="exercise_suggestions.db_list_all_exercise_suggestions")
    try:
        q = sb.table(TABLE_EXERCISE_SUGGESTIONS).select("*")
        if status:
            q = q.eq("status", str(status))
        res = q.order("created_at", desc=True).limit(int(limit)).execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-EX-SUGGEST] list_all error:", repr(e))
        return []