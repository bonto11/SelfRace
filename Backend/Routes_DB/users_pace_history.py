from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

from Configs.config import TABLE_USERS_PACE_HISTORY


def db_save_pace_history_batch(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Uloží sadu nových temp (zvyčajne všetkých 6 zón naraz).
    Každý row: {"user_id": int, "zone_index": int, "pace_s": int}
    """
    sb = get_sb(ctx, caller="users_pace_history.db_save_pace_history_batch")

    res = sb.table(TABLE_USERS_PACE_HISTORY).insert(rows).execute()
    return res.data or []


def db_get_latest_paces(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[int, int]:
    """
    Vráti najaktuálnejšie tempá pre každú zónu vo forme slovníka:
    { 1: 390, 2: 350, ... } (zone_index: pace_s)
    Používa sa pri generovaní Daily plánu pre AI kontext.
    """
    sb = get_sb(ctx, caller="users_pace_history.db_get_latest_paces")

    # Získame posledných 6 záznamov (predpokladáme Z1-Z6 zapísané v rovnakom čase)
    # Ak by boli zapisované v rôznom čase, Postgres 'DISTINCT ON' by bol lepší, 
    # ale pre Supabase client stačí limit a spracovanie v Pythone.
    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("zone_index, pace_s")
        .eq("user_id", user_id)
        .order("measured_at", desc=True)
        .limit(6)
        .execute()
    )

    data = res.data or []
    # Prekonvertujeme na plochý dict pre ľahšiu prácu v builderi
    return {item["zone_index"]: item["pace_s"] for item in data}


def db_get_pace_history_trends(
    user_id: int,
    days: int = 30,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti históriu temp za určité obdobie (default 1 mesiac) pre grafy.
    """
    sb = get_sb(ctx, caller="users_pace_history.db_get_pace_history_trends")
    
    since_date = (datetime.now() - timedelta(days=days)).isoformat()

    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("*")
        .eq("user_id", user_id)
        .gte("measured_at", since_date)
        .order("measured_at", desc=False) # Od najstaršieho po najnovšie pre graf
        .execute()
    )

    return res.data or []


def db_get_zone_trend(
    user_id: int,
    zone_index: int,
    limit: int = 10,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti históriu pre jednu konkrétnu zónu (napr. len trend Z2).
    """
    sb = get_sb(ctx, caller="users_pace_history.db_get_zone_trend")

    res = (
        sb.table(TABLE_USERS_PACE_HISTORY)
        .select("pace_s, measured_at")
        .eq("user_id", user_id)
        .eq("zone_index", zone_index)
        .order("measured_at", desc=True)
        .limit(limit)
        .execute()
    )

    return res.data or []