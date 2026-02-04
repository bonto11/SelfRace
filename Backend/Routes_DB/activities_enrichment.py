from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Načíta enrichment pre daného usera a zoznam activity_id.

    Vráti polia potrebné pre Pareto aj ďalšie analytiky:
      - activity_id
      - z1_min .. z5_min
      - sport_type_fe
      - avg_hr_bpm
      - moving_time_s
      - distance_m

    Použitie:
    - FE/AI:      db_get_enrichment_for_activities(..., user_jwt=jwt)
    - worker/cron db_get_enrichment_for_activities(..., service=True)
    """
    if not activity_ids:
        return []

    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_enrichment")

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select(
            "activity_id,"
            "z1_min,z2_min,z3_min,z4_min,z5_min,"
            "sport_type_fe,avg_hr_bpm,moving_time_s,distance_m",
            "ai_review",
        )
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
    """
    if not rows:
        return 0

    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_enrichment")

    print("[db_upsert_enrichment_rows] rows:", rows)
    saved = 0
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk,
            on_conflict="activity_id",  # ak chceš, môžeš zmeniť na "user_id,activity_id"
        ).execute()
        saved += len(chunk)
    print("[db_upsert_enrichment_rows] chunk:", chunk)
    return saved


def db_get_enrichment_for_activity(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=[activity_id],
        user_jwt=user_jwt,
        service=service,
    )
    return rows[0] if rows else None
