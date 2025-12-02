from __future__ import annotations
from typing import Any, Dict, Optional, List
from Modules.SQL.db_handler import get_client

supabase = get_client()


def db_insert_athlete_state(
    user_id: int,
    *,
    state_json: Dict[str, Any],
    model: Optional[str] = None,
    version: int = 1,
) -> Optional[int]:
    """
    INSERT do coach_athlete_state.
    Vracia id nového záznamu alebo None pri chybe.
    """
    try:
        res = (
            supabase.table("coach_athlete_state")
            .insert(
                {
                    "user_id": user_id,
                    "model": model,
                    "version": version,
                    "state_json": state_json,
                }
            )
            .execute()
        )
        rows = res.data or []
        return rows[0]["id"] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-ATHLETE-STATE] insert error:", repr(e))
        return None


def db_get_latest_athlete_state(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Posledný (najnovší) athlete_state pre daného užívateľa.
    """
    try:
        res = (
            supabase.table("coach_athlete_state")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-ATHLETE-STATE] latest error:", repr(e))
        return None


def db_get_athlete_state_by_id(state_id: int) -> Optional[Dict[str, Any]]:
    """
    Athlete_state podľa primárneho id.
    """
    try:
        res = (
            supabase.table("coach_athlete_state")
            .select("*")
            .eq("id", state_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-ATHLETE-STATE] by_id error:", repr(e))
        return None