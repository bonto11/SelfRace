# DB/activities_enrichment.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT

# =========================
# GET
# =========================


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    if not activity_ids:
        return []

    sb = get_sb(ctx, caller="activities_enrichment.db_get_enrichment_for_activities")

    fields = (
        "activity_id,"
        "z1_min,z2_min,z3_min,z4_min,z5_min,"
        "sport_type_fe,avg_hr_bpm,moving_time_s,distance_m,"
        "ai_review_thread,"
        "best_400m_s,best_1k_s,best_5k_s,best_10k_s,best_20k_s,"
        "best_half_s,best_30k_s,best_marathon_s,best_50k_s,"
        "best_swim_100m_s,best_swim_400m_s,best_swim_750m_s,best_swim_1k_s,"
        "best_swim_1500m_s,best_swim_1900m_s,best_swim_3800m_s,best_swim_5k_s,"
        "best_ride_10k_s,best_ride_20k_s,best_ride_40k_s,best_ride_50k_s,"
        "best_ride_90k_s,best_ride_100k_s,best_ride_100mi_s,best_ride_180k_s,"
        "updated_at"
    )

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select(fields)
        .eq("user_id", int(user_id))
        .in_("activity_id", list(set(int(x) for x in activity_ids)))
        .execute()
    )
    return res.data or []


def db_get_enrichment_for_activity(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=[activity_id],
        ctx=ctx,
    )
    return rows[0] if rows else None


def db_get_review_thread(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Vráti celý review thread (assistant/user entries) pre danú aktivitu."""
    sb = get_sb(ctx, caller="activities_enrichment.db_get_review_thread")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("ai_review_thread")
        .eq("user_id", int(user_id))
        .eq("activity_id", int(activity_id))
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return []
    thread = rows[0].get("ai_review_thread")
    return thread if isinstance(thread, list) else []


# =========================
# UPSERT (MERGE NON-NULL)
# =========================


def _strip_none(d: Dict[str, Any]) -> Dict[str, Any]:
    """Remove keys with None values so they don't overwrite existing DB values."""
    return {k: v for k, v in (d or {}).items() if v is not None}


def db_upsert_enrichment_rows_merge(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> int:
    """
    Upsert rows into activities_enrichment but NEVER overwrite existing values with None.
    - If row exists (user_id, activity_id): update only provided (non-None) fields.
    - If row doesn't exist: insert (can be partial).
    """
    if not rows:
        return 0

    sb = get_sb(ctx, caller="activities_enrichment.db_upsert_enrichment_rows_merge")

    saved = 0
    BATCH = 200

    for i in range(0, len(rows), BATCH):
        chunk_in = rows[i : i + BATCH]

        chunk: List[Dict[str, Any]] = []
        for r in chunk_in:
            if not isinstance(r, dict):
                continue
            if r.get("user_id") is None or r.get("activity_id") is None:
                continue

            clean = _strip_none(dict(r))
            clean["user_id"] = int(clean["user_id"])
            clean["activity_id"] = int(clean["activity_id"])
            chunk.append(clean)

        if not chunk:
            continue

        res = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .upsert(
                chunk,
                on_conflict="user_id,activity_id",
            )
            .execute()
        )

        err = getattr(res, "error", None)
        if err:
            print("❌ [ENRICH][upsert] error:", err)

        saved += len(chunk)

    return saved


# =========================
# AI REVIEW THREAD (APPEND)
# =========================
def db_append_review_thread_entries(
    *,
    user_id: int,
    activity_id: int,
    entries: List[Dict[str, Any]],
    ctx: AuthCtx,
) -> bool:
    """
    Pripojí nové entries (user/assistant) na koniec existujúceho threadu.
    Read-modify-write — pre jednu aktivitu sa nepredpokladá konkurentný zápis.
    """
    if not entries:
        return True

    sb = get_sb(ctx, caller="activities_enrichment.db_append_review_thread_entries")
    now_iso = datetime.now(timezone.utc).isoformat()

    current_thread = db_get_review_thread(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    new_thread = [*current_thread, *entries]

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "activity_id": int(activity_id),
        "ai_review_thread": new_thread,
        "updated_at": now_iso,
    }

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .upsert(row, on_conflict="user_id,activity_id")
        .execute()
    )

    err = getattr(res, "error", None)
    if err:
        print("❌ [ENRICH][thread append] error:", err)
        return False

    return True


def db_get_unreviewed_activities_for_push(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Nájde aktivity, ktoré sa skončili (updated_at) pred viac ako 1 hodinou,
    ale menej ako 2 hodinami, a ešte nemajú žiadny review v threade.
    """
    sb = get_sb(
        ctx, caller="activities_enrichment.db_get_unreviewed_activities_for_push"
    )

    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    two_hours_ago = (now - timedelta(hours=2)).isoformat()

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("activity_id, updated_at, ai_review_thread")
        .eq("user_id", int(user_id))
        .lte("updated_at", one_hour_ago)
        .gte("updated_at", two_hours_ago)
        .execute()
    )

    rows = res.data or []
    return [
        r
        for r in rows
        if not isinstance(r.get("ai_review_thread"), list)
        or len(r["ai_review_thread"]) == 0
    ]


def db_get_zone_minutes_for_ids(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Zónové minúty pre dané activity_ids."""
    if not activity_ids:
        return []
    sb = get_sb(ctx, caller="activities_enrichment.db_get_zone_minutes_for_ids")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("z1_min,z2_min,z3_min,z4_min,z5_min")
        .eq("user_id", user_id)
        .in_("activity_id", list(set(int(x) for x in activity_ids)))
        .execute()
    )
    return res.data or []