# Services/activities_review.py
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from Routes_DB.activities_enrichment import db_get_enrichment_for_activity
from Routes_DB.app_subscription import db_get_user_app_subscription_tier

from Services.async_jobs import service_enqueue_job

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _norm_comment(comment: Optional[str]) -> Optional[str]:
    if not isinstance(comment, str):
        return None
    c = comment.strip()
    return c if c else None

def _hash_comment(comment: str) -> str:
    return hashlib.sha256(comment.encode("utf-8")).hexdigest()


def service_get_activity_review(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    row = db_get_enrichment_for_activity(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    if not row:
        return None

    return {
        "review": row.get("ai_review"),
        "updated_at": row.get("updated_at"),
        "ai_review_version": row.get("ai_review_version"),
        "ai_review_last_user_comment": row.get("ai_review_last_user_comment"),
        "ai_review_last_user_comment_hash": row.get("ai_review_last_user_comment_hash"),
        "ai_review_last_user_comment_at": row.get("ai_review_last_user_comment_at"),
        "ai_review_last_source": row.get("ai_review_last_source"),
    }


def _max_ai_review_versions_for_tier(tier_code: str) -> int:
    t = (tier_code or "free").strip().lower()
    if t == "pro":
        return 3
    if t == "classic":
        return 2
    return 1  # free + unknown

def service_request_activity_review_rerun(
    *,
    user_id: int,
    activity_id: int,
    comment: Optional[str],
    model: Optional[str] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    c = _norm_comment(comment)

    row = db_get_enrichment_for_activity(
        user_id=int(user_id),
        activity_id=int(activity_id),
        ctx=ctx,
    ) or {}

    # tier -> limit
    tier_code = db_get_user_app_subscription_tier(int(user_id), ctx=ctx)
    max_versions = _max_ai_review_versions_for_tier(tier_code)

    # current version
    try:
        cur_version = int(row.get("ai_review_version") or 1)
    except Exception:
        cur_version = 1

    # if free: block immediately (lebo auto už spravilo version=1)
    if cur_version >= max_versions:
        return {
            "ok": False,
            "code": "activity_review_rerun_limit",
            "message": "Dosiahol si limit pre opätovné AI hodnotenie tejto aktivity.",
            "tier": tier_code,
            "ai_review_version": cur_version,
            "max_versions": max_versions,
        }

    # anti-spam: same comment => don't enqueue again
    if c:
        prev_hash = row.get("ai_review_last_user_comment_hash")
        if isinstance(prev_hash, str) and prev_hash and prev_hash == _hash_comment(c):
            return {
                "ok": False,
                "code": "same_comment_already_used",
                "message": "Tento komentár už bol použitý na prepočet review.",
                "ai_review_version": cur_version,
                "max_versions": max_versions,
            }

    # enqueue user job (dedupe must be unique for new reruns)
    dedupe_suffix = _hash_comment(c)[:12] if c else "no_comment"
    dedupe_key = f"activity_review_user:{user_id}:{activity_id}:{cur_version+1}:{dedupe_suffix}"

    out = service_enqueue_job(
        user_id=int(user_id),
        job_type="activity_review",
        payload={
            "activity_id": int(activity_id),
            "model": model,
            "source": "user",
            "comment": c,
        },
        priority=140,
        max_attempts=1,
        dedupe_key=dedupe_key,
        ctx=ctx,
    )

    if not out.get("job"):
        return {
            "ok": False,
            "code": "enqueue_failed",
            "message": out.get("note") or "enqueue_failed",
        }

    return {
        "ok": True,
        "job": out["job"],
        "note": out.get("note"),
        "tier": tier_code,
        "ai_review_version": cur_version,
        "max_versions": max_versions,
    }