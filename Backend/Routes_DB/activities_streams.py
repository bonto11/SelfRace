# backend/Routes_DB/activities_streams.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_STREAMS

supabase = get_client()


def db_get_streams_one(
    user_id: int,
    activity_id: int,
) -> Optional[Dict[str, Any]]:
    """
    Jedna row so streamami pre danú aktivitu:
      { time_s: [...], heartrate_bpm: [...] }
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_STREAMS)
        .select("time_s,heartrate_bpm")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .limit(1)
        .execute()
    )
    data = res.data or []
    return data[0] if data else None


def db_get_streams_ids_present(activity_ids: List[int]) -> List[int]:
    """
    Vráti zoznam activity_id, pre ktoré už existuje aspoň jeden stream záznam.
    Používa sa v compute_and_save_enrichment_for_ids na zistenie chýbajúcich.
    """
    if not activity_ids:
        return []

    res = (
        supabase.table(TABLE_ACTIVITIES_STREAMS)
        .select("activity_id")
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    rows = res.data or []
    out: List[int] = []
    for r in rows:
        try:
            out.append(int(r["activity_id"]))
        except Exception:
            pass
    return out