# Routes_DB/users_pace_history.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_USERS_PACE_HISTORY  # Nezabudni pridať do configu!


def db_save_pace_history(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží nový snapshot temp a odhadov pretekov (1 riadok = 1 analýza).
    Očakáva dict s kľúčmi: user_id, z1_pace_s, ..., est_5k_time_min, atď.
    """
    sb = get_sb(ctx, caller="users_pace_history.db_save_pace_history")

    res = sb.table(TABLE_USERS_PACE_HISTORY).insert(row).execute()
    rows: List[Dict[str, Any]] = res.data or []

    return rows[0] if rows else {}


def db_get_latest_paces(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najaktuálnejšie tempá a odhady pre daného usera (celý riadok).
    Používa sa pri generovaní Daily plánu pre AI kontext.
    """
    sb = get_sb(ctx, caller="users_pace_history.db_get_latest_paces")

    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .order("measured_at", desc=True)
        .limit(1)
        .execute()
    )

    rows: List[Dict[str, Any]] = res.data or []
    return rows[0] if rows else None


def db_get_pace_history_trends(
    user_id: int,
    days: int = 30,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti históriu všetkých temp a odhadov za určité obdobie (default 1 mesiac).
    Ideálne pre komplexný graf vývoja.
    """
    sb = get_sb(ctx, caller="users_pace_history.db_get_pace_history_trends")
    
    since_date = (datetime.now() - timedelta(days=days)).isoformat()

    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .gte("measured_at", since_date)
        .order("measured_at", desc=False) # Od najstaršieho po najnovšie (ideálne pre UI grafy)
        .execute()
    )

    return res.data or []
