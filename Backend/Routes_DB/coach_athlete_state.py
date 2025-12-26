# Routes_DB/coach_athlete_state.py  (pôvodne analyze_athlete_state.py)
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client_for_user
from Configs.config import TABLE_COACH_ATHLETE_STATE


def db_insert_athlete_state(
    user_id: int,
    model: str,
    state_json: Dict[str, Any],
    version: int = 1,
    user_jwt: Optional[str] = None,
) -> Optional[int]:
    """
    INSERT do coach_athlete_state cez user JWT klienta.

    Vracia id nového riadku alebo None pri chybe.
    """
    sb = get_client_for_user(user_jwt)

    row = {
        "user_id": user_id,
        "model": model,
        "version": version,
        "state_json": state_json,
    }
    try:
        res = sb.table(TABLE_COACH_ATHLETE_STATE).insert(row).execute()
        data = res.data or []
        if data and isinstance(data, list):
            return data[0].get("id")  # type: ignore[return-value]
        return None
    except Exception:
        return None


def db_get_state_by_id(
    state_id: int,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny stav podľa primárneho kľúča id.
    Beží pod user JWT, takže RLS ešte stále stráži, či user môže daný riadok čítať.
    """
    sb = get_client_for_user(user_jwt)

    try:
        res = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,state_json,created_at")
            .eq("id", state_id)
            .limit(1)
            .execute()
        )
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception:
        return None


def db_get_latest_state_for_user(
    user_id: int,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší stav pre daného usera (podľa created_at DESC).

    Ak version je None, nefiltruje podľa verzie.
    """
    sb = get_client_for_user(user_jwt)

    try:
        q = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,state_json,created_at")
            .eq("user_id", user_id)
        )
        if version is not None:
            q = q.eq("version", version)

        res = q.order("created_at", desc=True).limit(1).execute()
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception:
        return None


def db_list_states_for_user(
    user_id: int,
    limit: int = 20,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    História stavov pre usera (bez state_json, len meta – vhodné na prehľad v UI).
    """
    sb = get_client_for_user(user_jwt)

    try:
        res = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(res.data or [])
    except Exception:
        return []