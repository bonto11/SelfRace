# Services/activities_enrichment.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from Routes_DB.activities_enrichment import db_get_enrichment_for_activity
from Routes_DB.activities_summary import db_get_summary_for_activities
from Routes_DB.app_subscription import db_get_active_app_subscription_for_user
from Services.async_jobs import service_enqueue_job

# ============================================================
# HELPERS
# ============================================================

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
        diff = now - dt
        return diff.days
    except Exception:
        return 9999


# ============================================================
# READ SERVICE (ENRICHMENT)
# ============================================================

def service_get_activity_enrichment(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    row = db_get_enrichment_for_activity(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    return row

# ============================================================
# WRITE / RERUN SERVICE
# ============================================================

def service_request_activity_review_rerun(
    *,
    user_id: int,
    activity_id: int,
    comment: Optional[str],
    model: Optional[str] = None,
    has_new_injury: Optional[bool] = False, # ✅ TOTO MUSÍ BYŤ TAKTO (Nie `injury`)
    ctx: AuthCtx,
) -> Dict[str, Any]:
    
    print(f"service_request_activity_review_rerun | user_id={user_id} | activity_id={activity_id} | comment={comment} | injury={has_new_injury}")

    # 1. Získame summary aktivity kvôli dátumu
    summaries = db_get_summary_for_activities(ctx=ctx, user_id=user_id, activity_ids=[activity_id])
    if not summaries or not summaries[0]:
        return {
            "ok": False,
            "code": "activity_not_found",
            "message": "Aktivita nebola nájdená."
        }
    
    activity_date = summaries[0].get("date")
    
    # 2. Kontrola veku aktivity (Max 7 dní)
    days_old = _get_activity_days_ago(activity_date)
    if days_old > 7:
        return {
            "ok": False,
            "code": "activity_too_old",
            "message": "AI analýzu je možné vyžiadať len pre aktivity nie staršie ako 7 dní."
        }

    # 3. Načítanie stavu existujúceho review
    enr_row = (
        db_get_enrichment_for_activity(
            user_id=int(user_id),
            activity_id=int(activity_id),
            ctx=ctx,
        )
        or {}
    )

    current_review = enr_row.get("ai_review")
    cur_version = int(enr_row.get("ai_review_version") or 0) if current_review else 0

    # 4. Zistenie Tieru
    app_subscription = db_get_active_app_subscription_for_user(int(user_id), ctx=ctx) or {}
    tier_code = (app_subscription.get("tier_code") or "free").strip().lower()

    comment_from_user = _norm_comment(comment)

    # 5. Logika podľa Tierov
    max_versions = 1
    
    if tier_code == "pro":
        max_versions = 50
    elif tier_code == "classic":
        max_versions = 3
        if cur_version >= max_versions:
             return {
                "ok": False,
                "code": "limit_reached",
                "message": "Dosiahli ste limit pregenerovaní pre Classic účet.",
                "tier": tier_code
            }
    else: 
        if cur_version > 0:
             return {
                "ok": False,
                "code": "only_one_for_free_tier",
                "message": "Vo free verzii máte nárok len na jedno automatické hodnotenie.",
                "tier": tier_code
            }
        comment_from_user = None

    # 6. Kontrola duplicity (Anti-spam)
    # ⚠️ Ak posiela zranenie, ignorujeme duplicity filter, lebo zranenie mení kontext!
    if tier_code != "free" and current_review and not has_new_injury:
        last_comment = enr_row.get("ai_review_last_user_comment")
        if comment_from_user == last_comment:
             return {
                "ok": False,
                "code": "duplicate_content",
                "message": "Tento komentár ste už použili pri poslednom generovaní.",
            }

    # 7. Enqueue Job
    next_version = cur_version + 1
    dedupe_key = f"activity_review_user:{user_id}:{activity_id}:{next_version}"

    print(f"[AR][rerun] Enqueue | User: {user_id} | Tier: {tier_code} | Ver: {next_version} | Comm: {bool(comment_from_user)} | Injury: {has_new_injury}")

    # Tu posielame flag "has_new_injury" do job payloadu. Worker (Service vrstva) ho prečíta
    out = service_enqueue_job(
        user_id=int(user_id),
        job_type="activity_review",
        payload={
            "activity_id": int(activity_id),
            "model": model,
            "source": "user",
            "comment": comment_from_user,
            "has_new_injury": has_new_injury, # ✅ Pridanie informácie pre workera!
            "target_version": next_version
        },
        priority=140,
        max_attempts=1,
        dedupe_key=dedupe_key,
        ctx=ctx,
    )

    if not out.get("job"):
        print("[AR][rerun] Enqueue Failed:", out.get("note"))
        return {
            "ok": False,
            "code": "enqueue_failed",
            "message": "Nepodarilo sa zaradiť požiadavku.",
        }

    return {
        "ok": True,
        "job_id": out["job"].get("id"),
        "tier": tier_code,
        "next_version": next_version,
        "comment_used": bool(comment_from_user)
    }