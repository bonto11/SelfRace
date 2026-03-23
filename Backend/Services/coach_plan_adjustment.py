# Services/coach_plan_adjustment.py
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional, List
from statistics import mean

from Routes_DB.coach_plan_daily import (
    db_reschedule_daily_sessions_bulk,
    db_clear_daily_for_user_range
)
from Modules.Supabase.auth import AuthCtx
from Modules.Supabase.client import get_sb

from Services.AI.athlete_state.main import service_analyze_athlete
from Services.AI.weekly_plan.main import service_generate_weekly_plan

from Services.AI.daily_plan.main import (
    service_generate_daily_week,
    service_auto_extend_daily_plan,
    service_get_daily_overview,
)

from Services.analytics_RecentLoad import service_build_recent_load_raw
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_DB.coach_plan_weekly import (
    db_get_weekly_for_user_plan,
    db_delete_future_weekly_plans # ✅ NOVÝ IMPORT NA ZMAZANIE WEEKLY!
)
from Routes_DB.user_recovery import db_get_recent_recovery

from Configs.config import WEEKLY_REPLAN_COOLDOWN_DAYS, MIN_DAILY_HORIZON_AFTER_WEEKLY

# --- Import notifikácií ---
from Services.notifications import service_notify_autorecovery_applied


def _to_date(val: Any) -> Optional[date]:
    if isinstance(val, date) and not isinstance(val, datetime): return val
    if isinstance(val, datetime): return val.date()
    if isinstance(val, str):
        try: return datetime.fromisoformat(val[:10]).date()
        except Exception: return None
    return None

def _safe_int(v: Any, default: int = 0) -> int:
    try: return int(v) if v is not None else default
    except Exception: return default

def _find_current_week_index(weekly_rows: List[Dict[str, Any]], *, today: date) -> Optional[int]:
    if not isinstance(weekly_rows, list) or not weekly_rows: return None
    weekly_sorted = sorted(weekly_rows, key=lambda w: int(w.get("week_index") or 0))
    for w in weekly_sorted:
        ws = _to_date(w.get("week_start"))
        we = _to_date(w.get("week_end") or w.get("week_start"))
        if not ws or not we: continue
        if ws <= today <= we: return int(w.get("week_index") or 0)
    candidate: Optional[int] = None
    for w in weekly_sorted:
        ws = _to_date(w.get("week_start"))
        if not ws: continue
        if ws <= today: candidate = int(w.get("week_index") or 0)
    return candidate

def _compute_be_flags_recent_load(user_id: int, *, window_days: int = 42, ctx: AuthCtx) -> Dict[str, Any]:
    rl = service_build_recent_load_raw(user_id=user_id, window_days=window_days, ctx=ctx)
    weeks: List[Dict[str, Any]] = rl.get("weeks") or []
    if not weeks:
        return {"has_data": False, "should_trigger_ai": False, "action": None, "reason": "no_recent_load_data"}
    
    current = next((w for w in weeks if w.get("week_index_from_now") == 0), weeks[-1])
    curr_min = float(current.get("total_minutes") or 0.0)
    prev_weeks = [w for w in weeks if isinstance(w.get("week_index_from_now"), int) and w["week_index_from_now"] < 0]
    prev_weeks_sorted = sorted(prev_weeks, key=lambda w: int(w.get("week_index") or 0))
    recent_baseline_weeks = prev_weeks_sorted[-3:] if len(prev_weeks_sorted) >= 3 else prev_weeks_sorted
    
    baseline = sum(float(w.get("total_minutes") or 0.0) for w in recent_baseline_weeks) / len(recent_baseline_weeks) if recent_baseline_weeks else curr_min
    ratio = curr_min / baseline if baseline > 0 else 1.0
    hard_current = int(current.get("hard_sessions") or 0)

    if ratio > 1.4 or (curr_min > baseline + 150):
        return {"has_data": True, "should_trigger_ai": True, "action": "weekly_replan", "reason": "large_weekly_load_spike", "ratio": ratio}
    if ratio > 1.2 or hard_current >= 3:
        return {"has_data": True, "should_trigger_ai": True, "action": "daily_soften", "reason": "moderate_spike_or_many_hard_sessions", "ratio": ratio}
    return {"has_data": True, "should_trigger_ai": False, "action": None, "reason": "load_within_normal_range", "ratio": ratio}

def _compute_recovery_debug(user_id: int, *, ctx: AuthCtx, days: int = 21) -> Optional[Dict[str, Any]]:
    rows = db_get_recent_recovery(user_id, days, ctx=ctx) or []
    if not rows: return {"latest_date": None, "latest_RHR_bpm": None, "latest_HRV_ms": None}
    
    latest = rows[0]
    
    recent_vals: List[float] = []
    for r in rows[:7]:
        v = r.get("HRV_avg_ms")
        if isinstance(v, (int, float)) and v > 0:
            recent_vals.append(float(v))
            
    prev_vals: List[float] = []
    for r in rows[7:21]:
        v = r.get("HRV_avg_ms")
        if isinstance(v, (int, float)) and v > 0:
            prev_vals.append(float(v))

    return {
        "latest_date": latest.get("date"),
        "latest_RHR_bpm": latest.get("RHR_bpm"),
        "latest_HRV_ms": latest.get("HRV_avg_ms"),
        "hrv_7d_avg": mean(recent_vals) if recent_vals else None,
        "hrv_prev_7_21d_avg": mean(prev_vals) if prev_vals else None,
    }


def _apply_autorecovery_to_today(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="coach_plan_adjustment._apply_autorecovery")
    today_iso = date.today().isoformat()
    
    try:
        res = sb.table("coach_plan_daily").select("*").eq("user_id", user_id).eq("plan_date", today_iso).execute()
        sessions = res.data or []
        
        if not sessions:
            return {"changed": False, "mode": "autorecovery", "reason": "today_is_already_rest_day"}
        
        first_session = sessions[0]
        title = str(first_session.get("title") or "").lower()
        session_type = str(first_session.get("session_type") or "").lower()
        
        if session_type == "recovery" or "regen" in title or "recovery" in title:
            return {"changed": False, "mode": "autorecovery", "reason": "today_is_already_recovery"}
        
        sport = first_session.get("sport") or "run"
        sport_label = "beh" if sport == "run" else "jazda" if sport in ("ride", "cycling") else "tréning"
        
        payload = first_session.get("payload") or {}
        payload["structure"] = {
            "warmup": {"minutes": 5, "notes": "Z1 - veľmi pomaly"},
            "main_part": {"minutes": 25, "notes": "Z1/Z2 - regeneračné tempo, čisto na uvoľnenie nôh"},
            "cooldown": {"minutes": 5, "notes": "Z1 / Chôdza"}
        }
        
        update_data = {
            "title": f"Regeneračný {sport_label} (Auto-Recovery)",
            "duration_min": 35,
            "intensity": "Z1/Z2",
            "session_type": "recovery",
            "notes": "Systém automaticky upravil dnešný tréning na ľahký kvôli tvojim horším dátam z nočnej regenerácie.",
            "payload": payload
        }
        
        sb.table("coach_plan_daily").update(update_data).eq("id", first_session["id"]).execute()
        
        for extra_session in sessions[1:]:
            sb.table("coach_plan_daily").delete().eq("id", extra_session["id"]).execute()
            
        try:
            service_notify_autorecovery_applied(user_id=user_id, ctx=ctx)
        except Exception as e:
            print(f"[AUTORECOVERY] Failed to send push notification: {repr(e)}")
            
        return {"changed": True, "mode": "autorecovery", "reason": "today_changed_to_recovery"}
        
    except Exception as e:
        print(f"[AUTORECOVERY] DB Update Error for user {user_id}: {repr(e)}")
        return {"changed": False, "mode": "autorecovery", "reason": "db_error"}


def service_coach_autoadjust_after_update(
    user_id: int,
    *,
    ctx: AuthCtx,
    force_reason: Optional[str] = None, 
) -> Dict[str, Any]:
    
    print(f"[AUTOADJUST DEBUG] Started for user_id={user_id}, force_reason={force_reason}")

    if force_reason == "autorecovery":
        return _apply_autorecovery_to_today(user_id=user_id, ctx=ctx)

    today = date.today()

    be_flags = _compute_be_flags_recent_load(user_id=user_id, window_days=42, ctx=ctx)
    recovery_debug = _compute_recovery_debug(user_id=user_id, ctx=ctx)

    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx) or db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta:
        print("[AUTOADJUST DEBUG] No plan meta found. Exiting.")
        return {"changed": False, "mode": "no_plan"}

    meta_created = _to_date(meta.get("created_at") or meta.get("generated_at"))
    weekly_age_days = (today - meta_created).days if meta_created else None

    state_id = None
    plan_adjustment = {}
    weekly_replan_should = False
    soften_should = False
    soften_reason = ""
    weekly_replan_reason = ""

    # ✅ KRITICKÉ ZRANENIE (9/10): Neskúšame adaptovať, len zmažeme budúcnosť
    if force_reason == "health_critical":
        print("[AUTOADJUST DEBUG] Critical health reported! Suspending plan.")
        
        # 1. Zmažeme daily plán
        db_clear_daily_for_user_range(
            user_id=user_id,
            date_from=(today + timedelta(days=1)).isoformat(), 
            date_to=(today + timedelta(days=100)).isoformat(),
            ctx=ctx,
            global_user_clear=True
        )
        
        # 2. Zmažeme weekly plán! ✅ TOTO TU CHÝBALO!
        db_delete_future_weekly_plans(
             user_id=user_id,
             from_date_iso=(today + timedelta(days=1)).isoformat(),
             ctx=ctx
        )

        return {
            "changed": True,
            "mode": "plan_suspended",
            "reason": "critical_injury_reported_future_deleted"
        }

    # 1. Zjemniť (Soften)
    if force_reason in ["health_mild_restriction", "manual_review"]:
        soften_should = True 
        soften_days = 7 
        soften_reason = f"Health or Review triggered soften. Reason: {force_reason}"
        plan_adjustment = {"reason": force_reason}
        be_flags["should_trigger_ai"] = True
        
    # 2. KOMPLETNÝ REPLAN (po vyliečení!)
    elif force_reason in ["health_resolved", "return_to_training"]:
        weekly_replan_should = True 
        weekly_replan_reason = f"Health status resolved, initiating Return to Play. (Reason: {force_reason})."
        plan_adjustment = {"reason": force_reason}
        be_flags["should_trigger_ai"] = True

    # 3. Ak to neprišlo z health logu, pýtame sa AI na klasický auto-adjust
    else:
        analyze_resp = service_analyze_athlete(user_id=user_id, ctx=ctx, model=None)
        state_id = analyze_resp.get("state_id")
        ai_state = (analyze_resp.get("analysis") or {}).get("ai_state") or {}
        plan_adjustment = ai_state.get("plan_adjustment") or {}

        soften_block = plan_adjustment.get("soften_next_days") or {}
        soften_should = bool(soften_block.get("should_soften"))
        soften_days = soften_block.get("days") or 0
        soften_reason = soften_block.get("reason")
        weekly_replan_should = bool(plan_adjustment.get("should_replan_weekly"))
        weekly_replan_reason = plan_adjustment.get("weekly_replan_reason")

    print(f"[AUTOADJUST DEBUG] Evaluation complete. soften_should={soften_should}, weekly_replan_should={weekly_replan_should}")

    if not be_flags.get("should_trigger_ai") and not soften_should and not weekly_replan_should:
        return {
            "changed": False,
            "mode": "no_adjustment_needed",
            "reason": be_flags.get("reason", "load_within_normal_range"),
        }

    if weekly_replan_should:
        print("[AUTOADJUST DEBUG] Starting Weekly Replan...")
        if force_reason not in ["health_mild_restriction", "health_critical", "health_resolved", "return_to_training"] and weekly_age_days is not None and weekly_age_days < WEEKLY_REPLAN_COOLDOWN_DAYS:
            print("[AUTOADJUST DEBUG] Weekly replan on cooldown, converting to soften.")
            soften_should = True
            soften_days = 3
            soften_reason = "Weekly replan on cooldown, applying daily soften instead."
        else:
            db_clear_daily_for_user_range(
                user_id=user_id,
                date_from=today.isoformat(),
                date_to=(today + timedelta(days=100)).isoformat(),
                ctx=ctx,
                global_user_clear=True
            )
            print("[AUTOADJUST DEBUG] Cleared future daily plan rows.")

            weekly_resp = service_generate_weekly_plan(
                user_id=user_id,
                overwrite=True,
                state_id=state_id,
                weeks=None,
                model=None,
                override_start_date=None, 
                ctx=ctx,
            )
            print(f"[AUTOADJUST DEBUG] Weekly generator finished. Success: {weekly_resp.get('success')}")
            
            weekly_rows = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx) or []
            
            cur_idx = _find_current_week_index(weekly_rows, today=today)
            if cur_idx is None and weekly_rows:
                weekly_sorted = sorted(weekly_rows, key=lambda w: int(w.get("week_index") or 0))
                cur_idx = int(weekly_sorted[0].get("week_index") or 1)
            elif cur_idx is None:
                cur_idx = 1
                
            print(f"[AUTOADJUST DEBUG] Decided to generate daily plan for week_index={cur_idx}")
            
            daily_res = service_generate_daily_week(
                user_id=user_id,
                week_index=cur_idx,
                model=None,
                drop_past_days=False, 
                reason=force_reason or "weekly_replan",
                ctx=ctx,
            )
            
            print(f"[AUTOADJUST DEBUG] Daily generator finished. Output: {daily_res}")

            daily_extend = service_auto_extend_daily_plan(
                user_id=user_id,
                min_horizon_days=MIN_DAILY_HORIZON_AFTER_WEEKLY,
                ctx=ctx,
            )

            return {
                "changed": True,
                "mode": "weekly_replan",
                "reason": weekly_replan_reason or "weekly plan re-generated",
                "plan_adjustment": plan_adjustment,
                "daily_extend": daily_extend,
                "daily_result_debug": daily_res
            }

    if soften_should:
        print("[AUTOADJUST DEBUG] Starting Daily Soften...")
        weekly_rows = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx) or []
        if not isinstance(weekly_rows, list):
            weekly_rows = []
            
        if not weekly_rows: return {"changed": False, "mode": "no_weekly_rows"}
        
        cur_idx = _find_current_week_index(weekly_rows, today=today)
        if cur_idx is None: return {"changed": False, "mode": "cannot_determine_current_week"}

        print(f"[AUTOADJUST DEBUG] Daily Soften running for week_index={cur_idx}")
        daily_resp = service_generate_daily_week(
            user_id=user_id, 
            week_index=cur_idx, 
            model=None, 
            drop_past_days=False, 
            reason=force_reason or "soften",
            ctx=ctx
        )
        print(f"[AUTOADJUST DEBUG] Daily soften finished. Output: {daily_resp}")
        
        return {
            "changed": True,
            "mode": "daily_soften",
            "reason": soften_reason,
            "affected_week_index": cur_idx,
            "daily_result": {"week_index": daily_resp.get("week_index"), "debug": daily_resp}
        }

    return {"changed": False, "mode": "no_adjustment", "reason": "No changes requested"}

def service_reschedule_daily_plan(
    user_id: int,
    *,
    moves: List[Dict[str, Any]],
    horizon_days: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    if not moves:
        return service_get_daily_overview(
            user_id=user_id,
            horizon_days=horizon_days,
            ctx=ctx,
        )

    cleaned: List[Dict[str, Any]] = []
    for m in moves:
        sid = m.get("id")
        to_date = (m.get("to_date") or "").strip()
        from_date = (m.get("from_date") or "").strip()

        if not isinstance(sid, int):
            raise ValueError("moves[].id must be int")
        if not to_date or len(to_date) < 10:
            raise ValueError("moves[].to_date is required (YYYY-MM-DD)")
        if not from_date or len(from_date) < 10:
            raise ValueError("moves[].from_date is required (YYYY-MM-DD)")

        if to_date[4] != "-" or to_date[7] != "-":
            raise ValueError(f"Invalid to_date: {to_date}")
        if from_date[4] != "-" or from_date[7] != "-":
            raise ValueError(f"Invalid from_date: {from_date}")

        cleaned.append(
            {
                "id": int(sid),
                "from_date": from_date[:10],
                "to_date": to_date[:10],
            }
        )

    out = db_reschedule_daily_sessions_bulk(
        user_id=user_id,
        moves=cleaned,
        max_per_day=2,
        ctx=ctx,
    )

    if not out.get("ok"):
        raise ValueError(out.get("error") or "reschedule_failed")

    return service_get_daily_overview(
        user_id=user_id,
        horizon_days=horizon_days,
        ctx=ctx,
    )