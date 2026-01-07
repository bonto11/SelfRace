from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_USERS_BESTS

def db_fetch_user_bests(
    user_id: int,
    sport: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Low-level SELECT pre users_bests.
    Nerieši time_str ani validáciu.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="user_bests")

    res = (
        sb.table(TABLE_USERS_BESTS)
        .select(
            "user_id,sport,distance_m,best_time_s,"
            "activity_id,activity_name,achieved_at,updated_at"
        )
        .eq("user_id", user_id)
        .eq("sport", sport)
        .order("distance_m", desc=False)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows


def db_upsert_user_best(
    row: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Low-level UPSERT. Predpokladá už zvalidované a normalizované pole `row`.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="user_bests")

    res = (
        sb.table(TABLE_USERS_BESTS)
        .upsert(row, on_conflict="user_id,sport,distance_m")
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    # Supabase pri upserte vráti celý riadok; ak by nie, vrátime aspoň to, čo sme poslali.
    return rows[0] if rows else row


def db_delete_user_best(
    user_id: int,
    sport: str,
    distance_m: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    """
    Hard delete; vráti počet zmazaných riadkov.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="user_bests")

    res = (
        sb.table(TABLE_USERS_BESTS)
        .delete()
        .eq("user_id", user_id)
        .eq("sport", sport)
        .eq("distance_m", distance_m)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return len(rows)