# backend/Routes_DB/activities_enrichment.py
from __future__ import annotations

from typing import Any, Dict, List

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT

supabase = get_client()


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
) -> List[Dict[str, Any]]:
    """
    Načíta enrichment pre daného usera a zoznam activity_id.
    Vráti len polia potrebné pre Pareto: z1–z5_min.
    """
    if not activity_ids:
        return []

    res = (
        supabase.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
        .eq("user_id", user_id)
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    return res.data or []


def db_upsert_enrichment_rows(rows: List[Dict[str, Any]]) -> int:
    """
    Batch upsert do activities_enrichment podľa activity_id.
    Vracia počet riadkov, ktoré sme sa pokúsili zapísať.
    """
    if not rows:
        return 0

    saved = 0
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        supabase.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk, on_conflict="activity_id"
        ).execute()
        saved += len(chunk)

    return saved