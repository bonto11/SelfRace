# Services/activities_review.py
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from Routes_DB.activities_enrichment import db_get_enrichment_for_activity
from Routes_DB.app_subscription import db_get_active_app_subscription_for_user

from Services.async_jobs import service_enqueue_job

def _norm_comment(comment: Optional[str]) -> Optional[str]:
    if not isinstance(comment, str):
        return None
    c = comment.strip()
    return c if c else None

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
    comment_from_user = _norm_comment(comment)

    row = (
        db_get_enrichment_for_activity(
            user_id=int(user_id),
            activity_id=int(activity_id),
            ctx=ctx,
        )
        or {}
    )

    # ---------- DEBUG (always) ----------

    review = row.get("ai_review")
    v = row.get("ai_review_version")

    if review is None:
        v = 0

    # tier -> limit
    app_subscription = db_get_active_app_subscription_for_user(int(user_id), ctx=ctx) or {}
    tier_code = app_subscription.get("tier_code") or ""
    max_versions = _max_ai_review_versions_for_tier(tier_code)

    # current version:
    #  - ak review NEEXISTUJE, verzia sa má správať ako 0 (aby free user nebol navždy bloknutý)
    #  - ak review existuje, berieme uloženú verziu (fallback 1)
    if not review:
        cur_version = 0
    else:
        cur_version = int(row.get("ai_review_version") or 0)

    print(
        "[AR][rerun] tier + version",
        {
            "effective_cur_version": cur_version,
            "tier_code": tier_code,
            "max_versions": max_versions,
        },
    )

    # limit check
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
    if comment_from_user == row.get("ai_review_lasprev_commentt_user_comment"):
        print("[AR][rerun] BLOCK", {"reason": "same_comment_already_used"})
        return {
            "ok": False,
            "code": "same_comment_already_used",
            "message": "Tento komentár už bol použitý na prepočet review.",
            "ai_review_version": cur_version,
            "max_versions": max_versions,
        }

    # enqueue user job
    next_version = cur_version + 1
    dedupe_key = (
        f"activity_review_user:{user_id}:{activity_id}:{next_version}"
    )

    print(
        "[AR][rerun] enqueue",
        {
            "dedupe_key": dedupe_key,
            "next_version": next_version,
            "model": model,
            "source": "user",
            "comment": comment_from_user,
        },
    )

    out = service_enqueue_job(
        user_id=int(user_id),
        job_type="activity_review",
        payload={
            "activity_id": int(activity_id),
            "model": model,
            "source": "user",
            "comment": comment_from_user,
        },
        priority=140,
        max_attempts=1,
        dedupe_key=dedupe_key,
        ctx=ctx,
    )

    if not out.get("job"):
        print("[AR][rerun] enqueue_failed", {"note": out.get("note")})
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
