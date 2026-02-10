from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
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
        "ai_review,updated_at,"
        # ✅ NEW
        "ai_review_version,"
        "ai_review_last_user_comment,"
        "ai_review_last_user_comment_at,"
        "ai_review_last_source"
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

        # 1) normalize + drop None fields (per row)
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

        # 2) upsert by composite key
        # NOTE: This will still overwrite provided columns with provided values,
        # but because we stripped None, we won't null-out existing data.
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
            print("[ENRICH][upsert] error:", err)

        saved += len(chunk)

    return saved


# =========================
# AI REVIEW (UPSERT + META)
# =========================
def db_upsert_ai_review_one(
    *,
    user_id: int,
    activity_id: int,
    ai_review: Any,
    ctx: AuthCtx,
    # ✅ NEW meta
    source: Optional[str] = None,  # "auto" | "user" | "service" | ...
    user_comment: Optional[str] = None,
) -> bool:
    sb = get_sb(ctx, caller="activities_enrichment.db_upsert_ai_review_one")
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1) fetch current meta (for version increment + optional diff)
    prev_version: int = 0
    try:
        prev = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("ai_review_version")
            .eq("user_id", int(user_id))
            .eq("activity_id", int(activity_id))
            .limit(1)
            .execute()
        )
        row0 = (prev.data or [None])[0]
        if isinstance(row0, dict):
            try:
                prev_version = int(row0.get("ai_review_version") or 0)
            except Exception:
                prev_version = 0
    except Exception:
        prev_version = 0

    new_version = max(1, prev_version + 1)

    # 2) build upsert row (do NOT overwrite comment fields with None)
    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "activity_id": int(activity_id),
        "ai_review": ai_review,
        "updated_at": now_iso,
        "ai_review_version": int(new_version),
    }

    if isinstance(source, str) and source.strip():
        row["ai_review_last_source"] = source.strip()

    # comment: set only if provided and non-empty
    c = user_comment.strip() if isinstance(user_comment, str) else ""
    if c:
        row["ai_review_last_user_comment"] = c
        row["ai_review_last_user_comment_at"] = now_iso

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .upsert(row, on_conflict="user_id,activity_id")
        .execute()
    )

    err = getattr(res, "error", None)
    if err:
        print("[ENRICH][ai_review upsert] error:", err)
        return False

    return True