#Services.coach_plan_adjustment
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Optional, List
from statistics import mean
from Routes_DB.coach_plan_daily import db_reschedule_daily_sessions_bulk


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

from Configs.config import WEEKLY_REPLAN_COOLDOWN_DAYS, MIN_DAILY_HORIZON_AFTER_WEEKLY


def _to_date(val: Any) -> Optional[date]:
    """
    Bezpečne spraví date z rôznych typov (datetime / str / date).
    """
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val).date()
        except Exception:
            return None
    return None


def _find_current_week_index(
    weekly_rows: List[Dict[str, Any]],
    *,
    today: date,
) -> Optional[int]:
    """
    Nájde week_index, do ktorého patrí dnešok.

    Logika:
      1) najprv week_start <= today <= week_end
      2) fallback: posledný týždeň s week_start <= today
    """
    if not weekly_rows:
        return None

    weekly_sorted = sorted(
        weekly_rows,
        key=lambda w: int(w.get("week_index") or 0),
    )

    # 1) priame trafiť medzi start/end
    for w in weekly_sorted:
        ws = _to_date(w.get("week_start"))
        we = _to_date(w.get("week_end") or w.get("week_start"))
        if not ws or not we:
            continue
        if ws <= today <= we:
            return int(w.get("week_index") or 0)

    # 2) fallback – posledný týždeň, ktorý už začal
    candidate: Optional[int] = None
    for w in weekly_sorted:
        ws = _to_date(w.get("week_start"))
        if not ws:
            continue
        if ws <= today:
            candidate = int(w.get("week_index") or 0)

    return candidate


def _compute_be_flags_recent_load(
    user_id: int,
    *,
    window_days: int = 42,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    BE heuristika nad recent_load – rozhodne, či vôbec má zmysel volať AI.

    Používame weekly agregáty:
      - total_minutes
      - week_index_from_now (0 = aktuálny týždeň, -1 = minulý, ...)

    - service=True → recent_load sa berie zo service summary
    - service=False → recent_load cez RLS (ak user_jwt)
    """
    rl = service_build_recent_load_raw(
        user_id=user_id,
        window_days=window_days,
        ctx=ctx,
    )

    weeks: List[Dict[str, Any]] = rl.get("weeks") or []

    if not weeks:
        return {
            "has_data": False,
            "should_trigger_ai": False,
            "action": None,
            "reason": "no_recent_load_data",
            "current_week_minutes": None,
            "baseline_minutes": None,
            "ratio": None,
        }

    # nájdi current week (week_index_from_now == 0), fallback na posledný
    current = None
    for w in weeks:
        if w.get("week_index_from_now") == 0:
            current = w
            break
    if current is None:
        current = weeks[-1]

    curr_min = float(current.get("total_minutes") or 0.0)

    # baseline = priemer posledných 2–3 týždňov pred current
    prev_weeks = [
        w
        for w in weeks
        if isinstance(w.get("week_index_from_now"), int)
        and w["week_index_from_now"] < 0
    ]
    prev_weeks_sorted = sorted(
        prev_weeks,
        key=lambda w: int(w.get("week_index_from_now") or 0),
    )

    recent_baseline_weeks = (
        prev_weeks_sorted[-3:] if len(prev_weeks_sorted) >= 3 else prev_weeks_sorted
    )
    if recent_baseline_weeks:
        baseline = sum(
            float(w.get("total_minutes") or 0.0) for w in recent_baseline_weeks
        ) / len(recent_baseline_weeks)
    else:
        baseline = curr_min  # fallback – bez histórie ber current ako baseline

    ratio = curr_min / baseline if baseline > 0 else 1.0

    hard_current = int(current.get("hard_sessions") or 0)

    if baseline <= 0 and curr_min <= 0:
        return {
            "has_data": True,
            "should_trigger_ai": False,
            "action": None,
            "reason": "no_meaningful_training_load",
            "current_week_minutes": curr_min,
            "baseline_minutes": baseline,
            "ratio": ratio,
            "hard_sessions": hard_current,
        }

    # veľký spike → weekly replan kandidát
    if ratio > 1.4 or (curr_min > baseline + 150):
        return {
            "has_data": True,
            "should_trigger_ai": True,
            "action": "weekly_replan",
            "reason": "large_weekly_load_spike",
            "current_week_minutes": curr_min,
            "baseline_minutes": baseline,
            "ratio": ratio,
            "hard_sessions": hard_current,
        }

    # stredný spike / veľa hard sessions → skôr soften daily
    if ratio > 1.2 or hard_current >= 3:
        return {
            "has_data": True,
            "should_trigger_ai": True,
            "action": "daily_soften",
            "reason": "moderate_spike_or_many_hard_sessions",
            "current_week_minutes": curr_min,
            "baseline_minutes": baseline,
            "ratio": ratio,
            "hard_sessions": hard_current,
        }

    return {
        "has_data": True,
        "should_trigger_ai": False,
        "action": None,
        "reason": "load_within_normal_range",
        "current_week_minutes": curr_min,
        "baseline_minutes": baseline,
        "ratio": ratio,
        "hard_sessions": hard_current,
    }


def _compute_recovery_debug(
    user_id: int,
    *,
    ctx: AuthCtx,
    days: int = 21,
) -> Optional[Dict[str, Any]]:
    """
    Debug dáta z user_recovery – priemer HRV, posledné RHR atď.
    Volá sa len v režime s RLS (user_jwt nie je None).
    """

    rows = (
        db_get_recent_recovery(
            user_id,
            days,
            ctx=ctx,
        )
        or []
    )

    if not rows:
        return {
            "latest_date": None,
            "latest_RHR_bpm": None,
            "latest_HRV_ms": None,
            "sleep_min": None,
            "hrv_7d_avg": None,
            "hrv_prev_7_21d_avg": None,
        }

    latest = rows[0]

    def _hrv_vals(slice_rows: List[Dict[str, Any]]) -> List[float]:
        vals: List[float] = []
        for r in slice_rows:
            v = r.get("HRV_avg_ms")
            if isinstance(v, (int, float)) and v > 0:
                vals.append(float(v))
        return vals

    recent_vals = _hrv_vals(rows[:7])
    prev_vals = _hrv_vals(rows[7:21])

    hrv_recent_avg = mean(recent_vals) if recent_vals else None
    hrv_prev_avg = mean(prev_vals) if prev_vals else None

    sleep_min = latest.get("sleep_duration_min")

    return {
        "latest_date": latest.get("date"),
        "latest_RHR_bpm": latest.get("RHR_bpm"),
        "latest_HRV_ms": latest.get("HRV_avg_ms"),
        "sleep_min": sleep_min,
        "hrv_7d_avg": hrv_recent_avg,
        "hrv_prev_7_21d_avg": hrv_prev_avg,
    }


def service_coach_autoadjust_after_update(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Hlavný orchestratór po nových dátach (activity sync / recovery update).

    - service režim (cron/webhook):
        service=True, user_jwt=None
        → recent_load & plán idú cez service klienta, AI tiež cez service

    - RLS režim (FE):
        service=False, user_jwt=JWT
        → všetko ide cez RLS
    """
    today = date.today()

    # --- 0) BE heuristika recent_load – vždy zo SERVICE summary ---
    be_flags = _compute_be_flags_recent_load(
        user_id=user_id,
        window_days=42,
        ctx=ctx,
    )

    # Recovery debug – len v RLS režime (user_jwt != None)
    recovery_debug = _compute_recovery_debug(
        user_id=user_id,
        ctx=ctx,
    )

    if not be_flags.get("should_trigger_ai"):
        # load je v norme → žiadne AI, žiadny re-plan
        return {
            "changed": False,
            "mode": "no_adjustment_needed",
            "reason": be_flags.get("reason", "load_within_normal_range"),
            "be_flags": be_flags,
            "recovery_debug": recovery_debug,
            "analyze_state_id": None,
            "plan_adjustment": None,
        }

    # --- 1) AI analyze ---
    analyze_resp = service_analyze_athlete(
        user_id=user_id,
        ctx=ctx,
        model=None,
    )
    state_id = analyze_resp.get("state_id")
    analysis = analyze_resp.get("analysis") or {}
    ai_state = analysis.get("ai_state") or {}
    plan_adjustment = ai_state.get("plan_adjustment") or {}

    soften_block = plan_adjustment.get("soften_next_days") or {}
    soften_should = bool(soften_block.get("should_soften"))
    soften_days = soften_block.get("days") or 0
    soften_reason = soften_block.get("reason")

    weekly_replan_should = bool(plan_adjustment.get("should_replan_weekly"))
    weekly_replan_reason = plan_adjustment.get("weekly_replan_reason")

    # --- 2) nájdeme aktívny / posledný plán (podľa režimu) ---
    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        ctx=ctx,
    ) or db_get_latest_plan_meta_for_user(
        user_id=user_id,
        ctx=ctx,
    )

    if not meta or not isinstance(meta.get("plan_id"), str):
        return {
            "changed": False,
            "mode": "no_plan",
            "reason": "no_plan_meta",
            "be_flags": be_flags,
            "recovery_debug": recovery_debug,
            "analyze_state_id": state_id,
            "plan_adjustment": plan_adjustment,
        }

    plan_id = meta["plan_id"]

    # koľko dní je weekly plán starý
    meta_created = _to_date(meta.get("created_at") or meta.get("generated_at"))
    weekly_age_days: Optional[int] = None
    if meta_created:
        weekly_age_days = (today - meta_created).days

    # --- 3a) WEEKLY REPLAN ---
    if weekly_replan_should:
        if (
            weekly_age_days is not None
            and weekly_age_days < WEEKLY_REPLAN_COOLDOWN_DAYS
        ):
            # príliš čerstvý weekly → padáme do daily softening logiky
            pass
        else:
            weekly_resp = service_generate_weekly_plan(
                user_id=user_id,
                overwrite=True,
                state_id=state_id,
                weeks=None,
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
                "reason": weekly_replan_reason
                or "weekly plan re-generated based on load & recovery",
                "be_flags": be_flags,
                "recovery_debug": recovery_debug,
                "analyze_state_id": state_id,
                "plan_adjustment": plan_adjustment,
                "weekly_plan_meta": {
                    "plan_id": weekly_resp.get("plan_id"),
                    "weeks": weekly_resp.get("weeks"),
                },
                "daily_extend": daily_extend,
            }

    # --- 3b) SOFTEN DAILY ---
    if soften_should and soften_days > 0:
        weekly_rows = (
            db_get_weekly_for_user_plan(
                user_id=user_id,
                plan_id=plan_id,
                ctx=ctx,
            )
            or []
        )

        if not weekly_rows:
            return {
                "changed": False,
                "mode": "no_weekly_rows",
                "reason": "no_weekly_rows_for_plan",
                "be_flags": be_flags,
                "recovery_debug": recovery_debug,
                "analyze_state_id": state_id,
                "plan_adjustment": plan_adjustment,
            }

        current_week_index = _find_current_week_index(
            weekly_rows,
            today=today,
        )

        if current_week_index is None:
            return {
                "changed": False,
                "mode": "cannot_determine_current_week",
                "reason": "cannot_determine_current_week",
                "be_flags": be_flags,
                "recovery_debug": recovery_debug,
                "analyze_state_id": state_id,
                "plan_adjustment": plan_adjustment,
            }

        daily_resp = service_generate_daily_week(
            user_id=user_id,
            week_index=current_week_index,
            plan_id=plan_id,
            model=None,
            ctx=ctx,
        )

        return {
            "changed": True,
            "mode": "daily_soften",
            "reason": soften_reason
            or f"softening next days (week_index={current_week_index}) based on load & recovery",
            "be_flags": be_flags,
            "recovery_debug": recovery_debug,
            "analyze_state_id": state_id,
            "plan_adjustment": plan_adjustment,
            "affected_week_index": current_week_index,
            "daily_result": {
                "plan_id": daily_resp.get("plan_id"),
                "week_index": daily_resp.get("week_index"),
                "week_start": daily_resp.get("week_start"),
                "week_end": daily_resp.get("week_end"),
            },
        }

    # --- 3c) AI síce zafungovalo, ale nič nechce meniť ---
    return {
        "changed": False,
        "mode": "no_adjustment",
        "reason": "plan_adjustment does not request changes",
        "be_flags": be_flags,
        "recovery_debug": recovery_debug,
        "analyze_state_id": state_id,
        "plan_adjustment": plan_adjustment,
    }
    
    

def service_reschedule_daily_plan(
    user_id: int,
    *,
    moves: List[Dict[str, Any]],
    horizon_days: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Reschedule daily sessions podľa PK (coach_plan_daily.id).
    Zmení plan_date (+ session_index na koniec cieľového dňa).
    Následne vráti nový overview.
    """
    if not moves:
        # nič nemeníme, len vráť aktuálny overview
        return service_get_daily_overview(
            user_id=user_id,
            horizon_days=horizon_days,
            ctx=ctx,
        )

    # minimálna validácia payloadu
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

        # basic ISO date shape check (neimportujem dateutil)
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

    # DB update (RLS – iba userove sessions)
    out = db_reschedule_daily_sessions_bulk(
        user_id=user_id,
        moves=cleaned,
        max_per_day=2,
        ctx=ctx,
    )

    if not out.get("ok"):
        raise ValueError(out.get("error") or "reschedule_failed")

    # fresh overview (už bude zoradený podľa plan_date/session_index z DB)
    return service_get_daily_overview(
        user_id=user_id,
        horizon_days=horizon_days,
        ctx=ctx,
    )
