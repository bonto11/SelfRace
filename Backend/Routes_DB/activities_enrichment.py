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
    if not activity_ids:
        return []

    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_enrichment")

    # ✅ Supabase select musí byť JEDEN string, nie 2 args.
    fields = (
        "activity_id,"
        "z1_min,z2_min,z3_min,z4_min,z5_min,"
        "sport_type_fe,avg_hr_bpm,moving_time_s,distance_m,"
        "ai_review,updated_at"
    )

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select(fields)
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
    if not rows:
        return 0

    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_enrichment")

    saved = 0
    BATCH = 200

    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]

        # ⚠️ odporúčam mať unikát (user_id, activity_id).
        # Ak ho máš, nastav on_conflict na "user_id,activity_id".
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk,
            on_conflict="user_id,activity_id",
        ).execute()

        saved += len(chunk)

    return saved

def db_update_ai_review_one(
    *,
    user_id: int,
    activity_id: int,
    ai_review: Any,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> bool:
    """
    Update ONLY activities_enrichment.ai_review for one (user_id, activity_id).
    Returns True if the update call succeeded and updated at least one row.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="activities_enrichment")

    print("[db_update_ai_review_one] start", {"user_id": user_id, "activity_id": activity_id})

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .update({"ai_review": ai_review})
        .eq("user_id", int(user_id))
        .eq("activity_id", int(activity_id))
        .execute()
    )

    data = getattr(res, "data", None)
    updated = bool(isinstance(data, list) and len(data) > 0)

    print("[db_update_ai_review_one] done", {"updated": updated, "returned_rows": len(data) if isinstance(data, list) else None})

    return updated

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