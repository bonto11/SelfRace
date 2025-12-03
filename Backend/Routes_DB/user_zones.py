# Routes_DB/user_zones.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_ZONES

sb = get_client()


def db_user_zones_fetch_all(user_id: int) -> List[Dict[str, Any]]:
    """
    Vráti VŠETKY riadky z users_zones pre daného usera, zoradené od najnovšieho.
    ŽIADNA logika, len raw DB výstup.
    """
    try:
        res = (
            sb.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


def db_user_zones_fetch_latest(
    user_id: int,
    sport_raw: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší riadok podľa user_id (+ voliteľne sport) alebo None.
    """
    try:
        q = (
            sb.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        if sport_raw:
            # pozor: tu žiadna logika canonical sport, FE/Service si to vyrieši
            q = q.ilike("sport", sport_raw)
        res = q.limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def db_user_zones_insert_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert jedného riadku do users_zones.
    Očakáva už normalizované DB stĺpce:
      user_id, sport, hr_max_bpm, z1_max_bpm, z2_min_bpm, ...
    """
    res = sb.table(TABLE_USERS_ZONES).insert(row).execute()
    return (res.data or [{}])[0]


def db_user_zones_fetch_all_desc(user_id: int) -> List[Dict[str, Any]]:
    """
    Alias na fetch_all – môžeš ho použiť, keď Service potrebuje prejsť všetky
    riadky a vybrať z nich ‘latest per sport’.
    """
    return db_user_zones_fetch_all(user_id)