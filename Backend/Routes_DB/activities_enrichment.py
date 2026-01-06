from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client, get_service_client
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT


def _get_sb(user_jwt: Optional[str]):
    """
    Vyberie správneho Supabase klienta podľa toho, či máme user_jwt.
    - s user_jwt → RLS klient (get_client)
    - bez user_jwt → service klient (get_service_client)
    """
    if user_jwt is not None:
        return get_client(user_jwt=user_jwt)
    return get_service_client()


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Načíta enrichment pre daného usera a zoznam activity_id.
    Vráti len polia potrebné pre Pareto: z1–z5_min.

    - s user_jwt: štandardný FE/AI read cez RLS
    - bez user_jwt: interné servisy / worker cez service klienta
    """
    if not activity_ids:
        return []

    sb = _get_sb(user_jwt)

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
    Batch upsert do activities_enrichment podľa activity_id (+ user_id).

    - s user_jwt: môžeš volať z FE-driven procesov, ktoré zapisujú enrichment
    - bez user_jwt: worker / webhook / cron cez service klienta
    """
    if not rows:
        return 0

    sb = _get_sb(user_jwt)

    saved = 0
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk,
            on_conflict="activity_id",  # ak chceš byť ultra-striktný, môžeš zmeniť na "user_id,activity_id"
        ).execute()
        saved += len(chunk)

    return saved