from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Načíta enrichment pre daného usera a zoznam activity_id.
    Vráti len polia potrebné pre Pareto: z1–z5_min.

    - vždy voláme get_client(user_jwt=...)
    """
    if not activity_ids:
        return []

    sb = get_client(user_jwt=user_jwt)

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
        .eq("user_id", user_id)
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    return res.data or []


def db_upsert_enrichment_rows(
    rows: List[Dict[str, Any]],
    user_jwt: Optional[str] = None,
) -> int:
    """
    Batch upsert do activities_enrichment podľa activity_id.

    Aj zápis ide cez get_client(user_jwt=...).
    Neskôr si môžeš dať pre worker špeciálny service klient, ak bude treba.
    """
    if not rows:
        return 0

    sb = get_client(user_jwt=user_jwt)

    saved = 0
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk, on_conflict="activity_id"
        ).execute()
        saved += len(chunk)

    return saved