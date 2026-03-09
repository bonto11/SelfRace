# Services/AI/activity_review/main.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx

from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
)

from Configs.config import (
    AI_PROVIDER,
    OPENAI_DEFAULT_MODEL,
    GEMINI_DEFAULT_MODEL,
)

from Services.AI.activity_review.builders import build_input_from_db as build_review_input
from Services.AI.activity_review.generate import generate_activity_review_json
from Routes_DB.activities_enrichment import db_upsert_ai_review_one
from Routes_DB.activities_enrichment import db_get_enrichment_for_activity
from Routes_DB.activities_summary import db_get_summary_for_activities
from Routes_DB.user_thresholds import db_upsert_user_threshold
from Routes_DB.user_prefs import db_get_pref_single
from Routes_DB.user_zones import db_user_zones_fetch_latest, db_user_zones_insert_row
from Routes_DB.app_subscription import db_get_active_app_subscription_for_user

def _calculate_zones_from_lthr(lthr: int, hr_max: int) -> Dict[str, int]:
    """
    Konzistentná logika výpočtu zón z LTHR (zhodná s FE).
    Vráti max hranice pre jednotlivé zóny.
    """
    return {
        "z1_max": round(lthr * 0.81),
        "z2_min": round(lthr * 0.81) + 1,
        "z2_max": round(lthr * 0.89),
        "z3_min": round(lthr * 0.89) + 1,
        "z3_max": round(lthr * 0.93),
        "z4_min": round(lthr * 0.93) + 1,
        "z4_max": round(lthr * 0.99),
        "z5_min": round(lthr * 0.99) + 1,
        "z5_max": hr_max
    }

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _default_ai_model() -> str:
    p = (AI_PROVIDER or "openai").strip().lower()
    if p == "gemini":
        return (GEMINI_DEFAULT_MODEL).strip()
    return (OPENAI_DEFAULT_MODEL).strip()

def _minify_context_for_ai(payload: Dict[str, Any]) -> Dict[str, Any]:
    ctx = json.loads(json.dumps(payload, default=str))
    u = ctx.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
    ctx.pop("_debug", None)
    return ctx

def _norm_comment(comment: Optional[str]) -> Optional[str]:
    if not isinstance(comment, str): return None
    c = comment.strip()
    return c if c else None

def _get_activity_days_ago(date_str: Optional[str]) -> int:
    if not date_str: return 9999  
    try:
        clean_date = str(date_str)[:10]
        dt = datetime.strptime(clean_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return (now - dt).days
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
    return db_get_enrichment_for_activity(user_id=user_id, activity_id=activity_id, ctx=ctx)

# ============================================================
# WRITE / RERUN SERVICE
# ============================================================
def service_request_activity_review_rerun(
    *,
    user_id: int,
    activity_id: int,
    comment: Optional[str],
    model: Optional[str] = None,
    has_new_injury: Optional[bool] = False, 
    ctx: AuthCtx,
) -> Dict[str, Any]:
    
    summaries = db_get_summary_for_activities(ctx=ctx, user_id=user_id, activity_ids=[activity_id])
    if not summaries or not summaries[0]:
        return {"ok": False, "code": "activity_not_found", "message": "Aktivita nebola nájdená."}
    
    days_old = _get_activity_days_ago(summaries[0].get("date"))
    if days_old > 7:
        return {"ok": False, "code": "activity_too_old", "message": "Analýzu je možné vyžiadať len pre aktivity do 7 dní."}

    enr_row = db_get_enrichment_for_activity(user_id=int(user_id), activity_id=int(activity_id), ctx=ctx) or {}
    current_review = enr_row.get("ai_review")
    cur_version = int(enr_row.get("ai_review_version") or 0) if current_review else 0

    app_subscription = db_get_active_app_subscription_for_user(int(user_id), ctx=ctx) or {}
    tier_code = (app_subscription.get("tier_code") or "free").strip().lower()
    comment_from_user = _norm_comment(comment)

    # --- 1. ANTI-CHEAT: Záchranná brzda API (Zabráni nekonečným zraneniam) ---
    if cur_version >= 10:
        return {"ok": False, "code": "hard_limit_reached", "message": "Bol dosiahnutý absolútny systémový limit pregenerovaní."}

    # --- 2. LOGIKA TIERU + ZDRAVOTNÁ VÝNIMKA ---
    if tier_code == "pro":
        max_versions = 3
    elif tier_code == "classic":
        max_versions = 2
        if cur_version >= max_versions and not has_new_injury:
             return {"ok": False, "code": "limit_reached", "message": "Dosiahli ste limit pregenerovaní pre Classic účet.", "tier": tier_code}
    else: 
        if cur_version > 0 and not has_new_injury:
             return {"ok": False, "code": "only_one_for_free_tier", "message": "Vo free verzii máte nárok len na jedno hodnotenie.", "tier": tier_code}
        if not has_new_injury:
            comment_from_user = None

    # --- 3. ANTI-SPAM DUPLICITY ---
    # Ignorujeme filter na duplicitu, len ak používateľ pridáva nové zranenie
    if tier_code != "free" and current_review and not has_new_injury:
        last_comment = enr_row.get("ai_review_last_user_comment")
        if comment_from_user == last_comment:
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
            "target_version": next_version
        },
        priority=140,
        max_attempts=1,
        dedupe_key=dedupe_key,
        ctx=ctx,
    )

    if not out.get("job"):
        return {"ok": False, "code": "enqueue_failed", "message": "Nepodarilo sa zaradiť požiadavku."}

    return {"ok": True, "job_id": out["job"].get("id"), "tier": tier_code, "next_version": next_version, "comment_used": bool(comment_from_user)}

# (service_activity_review ostáva z generátora pod tým - zjednotil som to už minule, aby Worker volal review engine)
def service_activity_review(
    user_id: int, activity_id: int, *, ctx: AuthCtx, model: Optional[str] = None, source: Optional[str] = None, comment: Optional[str] = None
) -> Dict[str, Any]:
    # ... Worker execution volá build_review_input -> generate_activity_review_json ...
    model_to_use = (model or _default_ai_model()).strip()
    src = (source or "").strip().lower() or "auto" 
    safe_comment = _norm_comment(comment)

    if src == "user" and is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {"ok": False, "error": {"code": "ai_quota_exceeded", "used_tokens_this_month": used}}

    input_data = build_review_input(user_id=user_id, activity_id=activity_id, ctx=ctx, source=src, user_comment=safe_comment)
    context_for_ai = _minify_context_for_ai(input_data)

    act = context_for_ai.get("activity") if isinstance(context_for_ai, dict) else None
    metrics = act.get("metrics") if isinstance(act, dict) else None
    if not isinstance(metrics, dict) or not metrics:
        return {"ok": False, "error": {"code": "missing_activity_data"}}

    print("service_activity_review context_for_ai" ,context_for_ai)

    review, trace = generate_activity_review_json(context_payload=context_for_ai, model=model_to_use, user_id=user_id, ctx=ctx)

    print("service_activity_review review",review)

    # --- LOGIKA PRE THRESHOLDY A ZÓNY ---
    if isinstance(review, dict) and review.get("suggested_thresholds"):
        sug = review["suggested_thresholds"]
        new_lthr = sug.get("hr_bpm")
        
        # 1. OPRAVA: Šport necháme tak, ako ho posiela AI/DB (v tvojom prípade "running")
        sport = sug.get("sport") or "running"
        
        if new_lthr:
            # Upsert thresholdu (ostáva rovnaký)
            threshold_row = {
                "sport": sport,
                "threshold_type": sug.get("threshold_type") or "LT2",
                "hr_bpm": new_lthr,
                "pace_sec_km": sug.get("pace_sec_km"),
                "power_watt": sug.get("power_watt"),
                "measurement_type": "ai_estimate",
                "updated_at": _now_iso()
            }
            db_upsert_user_threshold(user_id=user_id, row=threshold_row, ctx=ctx)

            try:
                prefs_row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
                prefs_val = (prefs_row.get("value") or {}) if prefs_row else {}
                calc_mode = prefs_val.get("preferences", {}).get("hr_zone_calc_mode", "manual")

                if calc_mode == "percent_lthr":
                    # Skúsime nájsť posledné zóny pre tento šport
                    latest_zones = db_user_zones_fetch_latest(user_id=user_id, sport_raw=sport, ctx=ctx)
                    
                    # 2. OPRAVA: Ak nájdeme staré zóny, zachováme tvoj HR Max (napr. 206)
                    # Ak nie, pozrieme sa do aktuálnej aktivity (z logu vidím 202)
                    if latest_zones:
                        hr_max = int(latest_zones.get("hr_max_bpm") or 206)
                        print(f"[DEBUG-AR] Found existing zones. Keeping HRmax: {hr_max}")
                    else:
                        # Ak úplne chýbajú zóny, skúsime vytiahnuť max_hr_bpm z aktivity v context_for_ai
                        act_metrics = context_for_ai.get("activity", {}).get("metrics", {})
                        hr_max = int(act_metrics.get("max_hr_bpm") or 200)
                        print(f"[DEBUG-AR] Existing zones not found. Using activity HRmax: {hr_max}")

                    z_vals = _calculate_zones_from_lthr(int(new_lthr), hr_max)

                    # 3. OPRAVA: Doplnený chýbajúci z5_min_bpm stĺpec
                    new_zone_row = {
                        "user_id": user_id,
                        "sport": sport,
                        "hr_max_bpm": hr_max,
                        "z1_max_bpm": z_vals["z1_max"],
                        "z2_min_bpm": z_vals["z2_min"],
                        "z2_max_bpm": z_vals["z2_max"],
                        "z3_min_bpm": z_vals["z3_min"],
                        "z3_max_bpm": z_vals["z3_max"],
                        "z4_min_bpm": z_vals["z4_min"],
                        "z4_max_bpm": z_vals["z4_max"],
                        "z5_min_bpm": z_vals["z5_min"], # ✅ Toto chýbalo a spôsobovalo crash
                    }
                    
                    db_user_zones_insert_row(new_zone_row, ctx=ctx)
                    print(f"[AR] Zones successfully updated for {sport}. New LTHR: {new_lthr}")
            
            except Exception as e:
                print(f"[AR] Zone recalculation error: {repr(e)}")

                
    if not isinstance(review, dict): review = {}
    review.setdefault("schema_version", 6)
    review.setdefault("generated_at", _now_iso())
    review["model"] = str(review.get("model") or trace.get("ok_model") or model_to_use)
    review.setdefault("activity_id", activity_id)

    usage = extract_usage_from_trace(trace, model_fallback=review["model"])
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id, usage=usage, job_type="coach.activity_review",
                source=src, billed_via="internal", charge_wallet=False,
                meta={"activity_id": activity_id, "source": src}, ctx=ctx,
            )
        except Exception as e: print("[AI_BILLING] error:", repr(e))

    try:
        db_upsert_ai_review_one(user_id=user_id, activity_id=activity_id, ai_review=review, ctx=ctx, source=src, user_comment=safe_comment)
    except Exception as e: print("[AR] db_upsert_ai_review_one error:", repr(e))

    return {"ok": True, "review": review}