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

from Services.AI.athlete_state import service_analyze_athlete
from Services.AI.weekly_plan import service_generate_weekly_plan
from Services.AI.daily_plan import (
    service_generate_daily_week,
    service_auto_extend_daily_plan,
    service_get_daily_overview,
)
from Services.analytics_RecentLoad import service_build_recent_load_raw
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_DB.coach_plan_weekly import db_get_weekly_for_user_plan
from Routes_DB.user_recovery import db_get_recent_recovery
from Routes_DB.user_prefs import db_get_pref_single

from Configs.config import WEEKLY_REPLAN_COOLDOWN_DAYS, MIN_DAILY_HORIZON_AFTER_WEEKLY

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


def service_coach_autoadjust_after_update(
    user_id: int,
    *,
    ctx: AuthCtx,
    force_reason: Optional[str] = None, 
) -> Dict[str, Any]:
    today = date.today()

    be_flags = _compute_be_flags_recent_load(user_id=user_id, window_days=42, ctx=ctx)
    recovery_debug = _compute_recovery_debug(user_id=user_id, ctx=ctx)

    is_critical_injury = False
    has_any_injury = False
    new_plan_start_date = None

    if force_reason == "new_injury":
        be_flags["should_trigger_ai"] = True
        be_flags["action"] = "injury_replan"
        be_flags["reason"] = "active_injury_reported_forcing_replan"
        
        try:
            prefs_row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
            if isinstance(prefs_row, dict):
                val = prefs_row.get("value")
                data = val if isinstance(val, dict) else prefs_row
                injuries = data.get("injuries", [])
                
                if isinstance(injuries, list) and len(injuries) > 0:
                    has_any_injury = True
                    max_sev = max((_safe_int(i.get("severity")) for i in injuries if isinstance(i, dict)), default=0)
                    
                    if max_sev >= 7:
                        is_critical_injury = True
                        new_plan_start_date = (today + timedelta(days=1)).isoformat()
        except Exception as e:
            print("[COACH_AUTOADJUST] Error fetching injury severity", repr(e))

    if not be_flags.get("should_trigger_ai"):
        return {
            "changed": False,
            "mode": "no_adjustment_needed",
            "reason": be_flags.get("reason", "load_within_normal_range"),
        }

    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx) or db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or not isinstance(meta.get("plan_id"), str):
        return {"changed": False, "mode": "no_plan"}

    plan_id = meta["plan_id"]
    meta_created = _to_date(meta.get("created_at") or meta.get("generated_at"))
    weekly_age_days = (today - meta_created).days if meta_created else None

    state_id = None
    plan_adjustment = {}
    weekly_replan_should = False
    soften_should = False

    if force_reason == "new_injury":
        if is_critical_injury:
            weekly_replan_should = True 
            weekly_replan_reason = "Critical injury reported - forcing hard replan."
            plan_adjustment = {"reason": "forced_critical_injury_override"}
        else:
            soften_should = True 
            soften_days = 7
            soften_reason = "Mild/Moderate injury reported - softening current week."
            plan_adjustment = {"reason": "mild_injury_soften"}
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

    if weekly_replan_should:
        if force_reason != "new_injury" and weekly_age_days is not None and weekly_age_days < WEEKLY_REPLAN_COOLDOWN_DAYS:
            soften_should = True
            soften_days = 3
            soften_reason = "Weekly replan on cooldown, applying daily soften instead."
        else:
            # ✅ ČISTKA: Keďže starý plán ide do koša, zmažeme jeho budúce tréningy v kalendári
            db_clear_daily_for_user_range(
                user_id=user_id,
                plan_id=plan_id,
                date_from=today.isoformat(),
                date_to=(today + timedelta(days=100)).isoformat(), # Zabezpečíme, že zmažeme celú budúcnosť
                ctx=ctx,
                global_user_clear=True # <----- PRIDAJ TOTO!!!
            )

            weekly_resp = service_generate_weekly_plan(
                user_id=user_id,
                overwrite=True,
                state_id=state_id,
                weeks=None,
                model=None,
                override_start_date=new_plan_start_date if is_critical_injury else None,
                ctx=ctx,
            )
            
            new_plan_id = weekly_resp.get("plan_id")
            cur_idx = 1
            
            service_generate_daily_week(
                user_id=user_id,
                week_index=cur_idx,
                plan_id=new_plan_id,
                model=None,
                ctx=ctx,
            )

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
                "weekly_plan_meta": {"plan_id": new_plan_id},
                "daily_extend": daily_extend,
            }

    if soften_should:
        weekly_rows = db_get_weekly_for_user_plan(user_id=user_id, plan_id=plan_id, ctx=ctx) or []
        if not isinstance(weekly_rows, list):
            weekly_rows = []
            
        if not weekly_rows: return {"changed": False, "mode": "no_weekly_rows"}
        
        cur_idx = _find_current_week_index(weekly_rows, today=today)
        if cur_idx is None: return {"changed": False, "mode": "cannot_determine_current_week"}

        daily_resp = service_generate_daily_week(
            user_id=user_id, 
            week_index=cur_idx, 
            plan_id=plan_id, 
            model=None, 
            drop_past_days=True, 
            ctx=ctx
        )
        
        return {
            "changed": True,
            "mode": "daily_soften",
            "reason": soften_reason,
            "affected_week_index": cur_idx,
            "daily_result": {"plan_id": daily_resp.get("plan_id"), "week_index": daily_resp.get("week_index")}
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