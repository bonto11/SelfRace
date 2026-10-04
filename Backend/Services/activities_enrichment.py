# Services/activities_enrichment.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

from DB.activities_enrichment import (
    db_get_review_thread,
    db_get_enrichment_for_activity,
)
from DB.activities_summary import db_get_summary_for_activities
from DB.app_subscription import db_get_active_app_subscription_for_user


def _norm_comment(comment: Optional[str]) -> Optional[str]:
    if not isinstance(comment, str):
        return None
    c = comment.strip()
    return c if c else None


def _get_activity_days_ago(date_str: Optional[str]) -> int:
    if not date_str:
        return 9999
    try:
        clean_date = str(date_str)[:10]
        dt = datetime.strptime(clean_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return (now - dt).days
    except Exception:
        return 9999


def _count_assistant_entries(thread: List[Dict[str, Any]]) -> int:
    return len([e for e in thread if isinstance(e, dict) and e.get("role") == "assistant"])


def _count_paid_assistant_entries(thread: List[Dict[str, Any]]) -> int:
    """
    Hodnotenia, ktoré sa rátajú do limitu pregenerovaní. Automatické
    hodnotenie z uvítacieho týždňa je darček - user si potom môže vyžiadať
    vlastné (napr. s komentárom) aj vo free verzii.
    """
    return len([
        e for e in thread
        if isinstance(e, dict) and e.get("role") == "assistant" and e.get("source") != "welcome"
    ])


def _norm_feeling(v: Any) -> Optional[int]:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= 5 else None


def _last_user_comment(thread: List[Dict[str, Any]]) -> Optional[str]:
    for entry in reversed(thread):
        if isinstance(entry, dict) and entry.get("role") == "user":
            c = entry.get("comment")
            return c if isinstance(c, str) else None
    return None


# ============================================================
# READ SERVICE (ENRICHMENT)
# ============================================================
def service_get_activity_enrichment(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    return db_get_enrichment_for_activity(user_id=user_id, activity_id=activity_id, ctx=ctx)


# ============================================================
# WRITE / RERUN SERVICE (= "reply" v threade)
# ============================================================
def service_request_activity_review_rerun(
    *,
    user_id: int,
    activity_id: int,
    comment: Optional[str],
    model: Optional[str] = None,
    has_new_injury: Optional[bool] = False,
    is_race_effort: Optional[bool] = False,
    feeling: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    summaries = db_get_summary_for_activities(ctx=ctx, user_id=user_id, activity_ids=[activity_id])
    if not summaries or not summaries[0]:
        return {"ok": False, "code": "activity_not_found", "message": "Aktivita nebola nájdená."}

    days_old = _get_activity_days_ago(summaries[0].get("date"))
    if days_old > 7:
        return {"ok": False, "code": "activity_too_old", "message": "Analýzu je možné vyžiadať len pre aktivity do 7 dní."}

    thread = db_get_review_thread(user_id=user_id, activity_id=activity_id, ctx=ctx)
    cur_version = _count_assistant_entries(thread)
    paid_version = _count_paid_assistant_entries(thread)
    safe_feeling = _norm_feeling(feeling)

    app_subscription = db_get_active_app_subscription_for_user(int(user_id), ctx=ctx) or {}
    tier_code = (app_subscription.get("tier_code") or "free").strip().lower()
    comment_from_user = _norm_comment(comment)

    # --- 1. ANTI-CHEAT: absolútny systémový limit ---
    if cur_version >= 10:
        return {"ok": False, "code": "hard_limit_reached", "message": "Bol dosiahnutý absolútny systémový limit pregenerovaní."}

    # --- 2. LOGIKA TIERU + ZDRAVOTNÁ VÝNIMKA ---
    if tier_code == "family":
        max_versions = 10
    elif tier_code == "pro":
        max_versions = 3
    elif tier_code == "classic":
        max_versions = 2
        if paid_version >= max_versions and not has_new_injury:
            return {"ok": False, "code": "limit_reached", "message": "Dosiahli ste limit pregenerovaní pre Classic účet.", "tier": tier_code}
    else:
        if paid_version > 0 and not has_new_injury:
            return {"ok": False, "code": "only_one_for_free_tier", "message": "Vo free verzii máte nárok len na jedno hodnotenie.", "tier": tier_code}
        if not has_new_injury:
            comment_from_user = None

    # --- 3. ANTI-SPAM DUPLICITY ---
    if tier_code != "free" and thread and not has_new_injury:
        last_comment = _last_user_comment(thread)
        if comment_from_user == last_comment and not is_race_effort:
            return {"ok": False, "code": "duplicate_content", "message": "Tento komentár ste už použili pri poslednom generovaní."}

    next_version = cur_version + 1
    dedupe_key = f"activity_review_user:{user_id}:{activity_id}:{next_version}"

    from Services.async_jobs import service_enqueue_job

    out = service_enqueue_job(
        user_id=int(user_id),
        job_type="activity_review",
        payload={
            "activity_id": int(activity_id),
            "model": model,
            "source": "user",
            "comment": comment_from_user,
            "has_new_injury": has_new_injury,
            "is_race_effort": is_race_effort,
            "feeling": safe_feeling,
            "target_version": next_version,
        },
        priority=140,
        max_attempts=1,
        dedupe_key=dedupe_key,
        ctx=ctx,
    )

    if not out.get("job"):
        return {"ok": False, "code": "enqueue_failed", "message": "Nepodarilo sa zaradiť požiadavku."}

    return {"ok": True, "job_id": out["job"].get("id"), "tier": tier_code, "next_version": next_version, "comment_used": bool(comment_from_user)}
