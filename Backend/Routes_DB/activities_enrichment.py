from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT


def _get_sb(
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
):
    """
    - service=True      → service-role klient (worker/webhook/cron)
    - user_jwt != None  → RLS klient (FE/AI)
    """
    if service:
        return get_service_client()
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    raise RuntimeError(
        "activities_enrichment: missing user_jwt or service=True in DB helper"
    )


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Načíta enrichment pre daného usera a zoznam activity_id.
    Vráti len polia potrebné pre Pareto: z1–z5_min.

    Použitie:
    - FE/AI:      db_get_enrichment_for_activities(..., user_jwt=jwt)
    - worker/cron db_get_enrichment_for_activities(..., service=True)
    """
    if not activity_ids:
        return []

    sb = _get_sb(user_jwt=user_jwt, service=service)

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
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> int:
    """
    Batch upsert do activities_enrichment podľa activity_id (+ user_id).

    Použitie:
    - FE-driven zapis: db_upsert_enrichment_rows(..., user_jwt=jwt)
    - worker/webhook:  db_upsert_enrichment_rows(..., service=True)
    """
    if not rows:
        return 0

    sb = _get_sb(user_jwt=user_jwt, service=service)

    saved = 0
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk,
            # keby si chcel byť prísnejší: "user_id,activity_id"
            on_conflict="activity_id",
        ).execute()
        saved += len(chunk)

    return saved