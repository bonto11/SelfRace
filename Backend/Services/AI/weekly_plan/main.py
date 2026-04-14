# Services/AI/weekly_plan/main.py
# Services/AI/weekly_plan/main.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)
from DB.activities_summary import db_get_activities_in_range_basic

from Services.AI.weekly_plan.builders import (
    build_weekly_context_from_db,
    extract_weeks_payload,
    build_weekly_rows_from_ai,
)

from Services.AI.weekly_plan.generate import generate_weekly_plan_json

from DB.coach_plan_weekly import (
    db_insert_weekly_rows,
    db_clear_weekly_for_user_plan,
    db_get_weekly_for_user_plan,
    db_get_weekly_row_by_date,
    db_update_weekly_actual_stats
)
from DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
)
from Modules.Supabase.auth import AuthCtx

def service_generate_weekly_plan(
    user_id: int,
    *,
    ctx: AuthCtx,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    override_start_date: Optional[str] = None,
    reason: Optional[str] = None, # <--- NOVÝ PARAMETER
) -> Dict[str, Any]:

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI plánov bol vyčerpaný. Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj.",
            "used_tokens_this_month": used,
        }

    context = build_weekly_context_from_db(
        user_id=user_id,
        ctx=ctx,
        state_id=state_id,
        weeks=weeks,
    )

    context_payload = context["context_payload"]
    
    # --- NOVÉ: Posúvame dôvod priamo pre generátor promptov ---
    if reason:
        context_payload["generate_reason"] = reason

    state_bundle = context["state_bundle"]
    horizon_weeks = context["horizon_weeks"]
    used_state_id = state_bundle["state_id"]

    if override_start_date:
        if isinstance(context_payload.get("prefs"), dict):
            context_payload["prefs"]["plan_start_date"] = override_start_date
            context_payload["replan_trigger"] = "critical_injury_override"

    # ✅ OPRAVA: Chytáme 3 premenné
    weekly_plan, trace, err_msg = generate_weekly_plan_json(
        context_payload=context_payload,
        model=model,  
        ctx=ctx,
    )

    if not weekly_plan:
        print(f"[WEEKLY-PLAN] AI Generation failed: {err_msg}")
        return {
            "ok": False,
            "code": trace.get("error_code") or "ai_generation_failed",
            "message": err_msg
        }

    model_used = str(weekly_plan.get("model") or model or "auto")

    # --- billing (best effort) ---
    usage = extract_usage_from_trace(trace)
    if usage:
        usage["model"] = model_used
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.generate_weekly_plan",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "state_id": used_state_id,
                    "requested_weeks": weeks,
                    "horizon_weeks": horizon_weeks,
                },
                ctx=ctx,
            )
        except Exception as e:
            print("[AI_BILLING] weekly_plan billing error:", repr(e))

    # --- overwrite: archive + clear previous weekly rows ---
    deleted_rows = 0
    if overwrite:
        deleted_rows = db_clear_weekly_for_user_plan(
            user_id=user_id,
            ctx=ctx,
        )

    # --- store weekly rows ---
    weeks_list = extract_weeks_payload(weekly_plan)
    rows: List[Dict[str, Any]] = build_weekly_rows_from_ai(
        user_id=user_id,
        weeks_list=weeks_list,
    )

    inserted_rows = db_insert_weekly_rows(rows, ctx=ctx)

    # --- plan_meta row (DB) ---
    plan_meta_dict = (weekly_plan.get("plan_meta") if isinstance(weekly_plan, dict) else {}) or {}
    start_date: Optional[str] = plan_meta_dict.get("start_date") or None
    end_date: Optional[str] = plan_meta_dict.get("end_date") or None

    if not start_date and weeks_list:
        start_date = weeks_list[0].get("week_start") or None
    if not end_date and weeks_list:
        last_week = weeks_list[-1]
        end_date = last_week.get("week_end") or last_week.get("week_start") or None

    meta_row = db_insert_plan_meta_generated(
        user_id=user_id,
        weeks_total=len(weeks_list) or horizon_weeks,
        start_date=start_date,
        end_date=end_date,
        ctx=ctx,
    )

    resp: Dict[str, Any] = {
        "ok": True,
        "state_id": used_state_id,
        "model": model_used,
        "overwrite": True,
        "weeks": horizon_weeks,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "weekly_plan": weekly_plan,
        "error": None,
    }
    if meta_row is not None:
        resp["plan_meta"] = meta_row

    return resp

def service_get_latest_weekly_plan(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    rows = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx)
    if not rows:
        return None

    weeks_out: List[Dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: int(x.get("week_index") or 0)):
        weeks_out.append(
            {
                "week_index": int(r.get("week_index") or 0),
                "week_start": r.get("week_start"),
                "week_end": r.get("week_end"),
                "goal": r.get("goal"),
                "focus": r.get("focus"),
                "load_phase": r.get("load_phase"),
                "planned_stats": r.get("planned_stats") or {},
                "actual_stats": r.get("actual_stats") or {},
                "notes": r.get("notes"),
            }
        )

    return {
        "weeks": weeks_out,
    }

# =========================================================================
# Weekly Volume Sync
# =========================================================================
def service_sync_weekly_volume_for_date(
    user_id: int,
    target_date: str,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    week_row = db_get_weekly_row_by_date(user_id=user_id, target_date_iso=target_date, ctx=ctx)
    
    if not week_row:
        return {"ok": False, "note": f"Date {target_date[:10]} does not fall into any active plan week."}
        
    week_start = week_row["week_start"]
    week_end = week_row["week_end"]
    row_id = week_row["id"]
    
    activities = db_get_activities_in_range_basic(
        ctx=ctx,
        user_id=user_id,
        start_ts_iso=f"{week_start}T00:00:00Z",
        end_ts_iso=f"{week_end}T23:59:59Z"
    )
    
    stats = {
        "run_distance_km": 0.0,
        "run_time_min": 0,
        "bike_distance_km": 0.0,
        "bike_time_min": 0,
        "swim_distance_m": 0.0,
        "swim_time_min": 0,
        "strength_time_min": 0,
        "other_time_min": 0,
    }
    
    for act in activities:
        act_type = str(act.get("sport_type") or act.get("sport_type_fe") or "").lower()
        dist_m = float(act.get("distance_m") or 0.0)
        time_sec = float(act.get("moving_time_s") or 0.0)
        time_min = int(time_sec / 60)
        
        if "run" in act_type:
            stats["run_distance_km"] += (dist_m / 1000.0)
            stats["run_time_min"] += time_min
        elif "ride" in act_type or "bike" in act_type or "cycl" in act_type:
            stats["bike_distance_km"] += (dist_m / 1000.0)
            stats["bike_time_min"] += time_min
        elif "swim" in act_type:
            stats["swim_distance_m"] += dist_m
            stats["swim_time_min"] += time_min
        elif "weight" in act_type or "strength" in act_type or "workout" in act_type:
            stats["strength_time_min"] += time_min
        else:
            stats["other_time_min"] += time_min
            
    stats["run_distance_km"] = round(stats["run_distance_km"], 2)
    stats["bike_distance_km"] = round(stats["bike_distance_km"], 2)
    stats["swim_distance_m"] = round(stats["swim_distance_m"], 2)

    success = db_update_weekly_actual_stats(row_id=row_id, actual_stats=stats, ctx=ctx)
    
    return {
        "ok": success, 
        "week_index": week_row.get("week_index"),
        "processed_activities": len(activities),
        "actual_stats_saved": stats
    }