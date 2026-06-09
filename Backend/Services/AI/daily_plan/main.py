# Services/AI/daily_plan/main.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Configs.config import COACH_PLAN_SCAN_HORIZON_DAYS
from Services.AI.daily_plan.generate import generate_daily_week_json
from DB.coach_plan_daily import (
    db_clear_daily_for_user_range,
    db_insert_daily_rows,
    db_list_daily_for_user_horizon,
    db_update_daily_session_data,
)
from DB.coach_plan_weekly import db_get_weekly_for_user_plan
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.AI.daily_plan.builders import (
    build_daily_context_from_db,
    build_daily_rows_from_ai,
)
from Services.coach_strength_mapper import extract_and_save_ai_strength_history
from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPERS
# ============================================================

def _reindex_sessions_per_day(daily_plan: Dict[str, Any]) -> Dict[str, Any]:
    """Opraví session_index v každom dni — zaručí 0-based sekvenciu."""
    if not isinstance(daily_plan, dict):
        return daily_plan
    days = daily_plan.get("days")
    if not isinstance(days, list):
        return daily_plan
    for day in days:
        if not isinstance(day, dict):
            continue
        sessions = day.get("sessions")
        if not isinstance(sessions, list):
            continue
        dict_sessions = [s for s in sessions if isinstance(s, dict)]
        for i, s in enumerate(dict_sessions):
            s["session_index"] = i
        day["sessions"] = dict_sessions
    return daily_plan


def _log_ai_usage(
    user_id: int,
    trace: Dict[str, Any],
    model: str,
    week_index: int,
    ctx: AuthCtx,
) -> None:
    """Zaloguje AI usage s provider a model z trace."""
    usage = extract_usage_from_trace(trace, model_fallback=model)
    if not usage:
        return
    try:
        log_ai_usage_for_user(
            user_id=user_id,
            usage=usage,
            job_type="coach.generate_daily_plan",
            source="user",
            billed_via="internal",
            charge_wallet=False,
            meta={
                "week_index": week_index,
                "provider": trace.get("ok_provider"),
                "model": trace.get("ok_model"),
            },
            ctx=ctx,
        )
    except Exception as e:
        print(f"[AI_BILLING] daily_plan error: {repr(e)}")


# ============================================================
# GENERATE DAILY WEEK
# ============================================================

def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    model: Optional[str] = None,
    drop_past_days: bool = False,
    reason: Optional[str] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Generuje denný tréningový plán pre daný týždeň.
    model=None = provider použije default z ENV.
    drop_past_days=True = vynechá dni pred dneškom (pri auto-extend).
    reason = špeciálny dôvod generovania pre prompt.
    """
    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    # Kvóta check
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI plánov bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    # Builder
    context = build_daily_context_from_db(
        user_id=user_id,
        week_index=week_index,
        ctx=ctx,
    )
    context_payload = context["context_payload"]
    week_meta = context["week_meta"]
    state_row = context["state_row"]

    if reason:
        context_payload["generate_reason"] = reason

    # AI generovanie
    ai_plan, trace, err_msg = generate_daily_week_json(
        context_payload=context_payload,
        model=model,
    )

    if not ai_plan:
        print(f"[DAILY-PLAN] AI Generation failed: {err_msg}")
        return {
            "ok": False,
            "code": trace.get("error_code") or "ai_generation_failed",
            "message": err_msg,
        }

    week_start = str(week_meta.get("week_start") or ai_plan.get("week_start") or "") or None
    week_end = str(week_meta.get("week_end") or ai_plan.get("week_end") or "") or None

    ai_plan.setdefault("week_index", week_index)
    if week_start:
        ai_plan.setdefault("week_start", week_start)
    if week_end:
        ai_plan.setdefault("week_end", week_end)

    days: List[Dict[str, Any]] = ai_plan.get("days") or []
    if len(days) == 0:
        return {"ok": False, "code": "daily_plan_empty", "message": "AI vrátil prázdny plán."}
    
    # Billing
    model_used = str(trace.get("ok_model") or ai_plan.get("model") or "unknown")
    _log_ai_usage(user_id, trace, model_used, week_index, ctx)

    ai_plan = _reindex_sessions_per_day(ai_plan)

    # Strength history
    try:
        extract_and_save_ai_strength_history(
            user_id=user_id, ai_daily_plan=ai_plan, ctx=ctx
        )
    except Exception as e:
        print(f"[STRENGTH_MAPPER] error: {repr(e)}")

    # Dátumový rozsah pre clear
    dates: List[str] = []
    for d in days:
        if not isinstance(d, dict):
            continue
        v = d.get("date") or d.get("plan_date")
        if isinstance(v, str) and v:
            dates.append(v[:10])

    date_from = min(dates) if dates else None
    date_to = max(dates) if dates else None
    today_iso = date.today().isoformat()

    if drop_past_days and date_from and date_from < today_iso:
        date_from = today_iso

    # Clear a insert
    deleted_rows = 0
    if date_from and date_to:
        deleted_rows = db_clear_daily_for_user_range(
            user_id=user_id, date_from=date_from, date_to=date_to, ctx=ctx
        )

    rows_to_insert = build_daily_rows_from_ai(user_id=user_id, daily_plan=ai_plan)
    if drop_past_days:
        rows_to_insert = [
            r for r in rows_to_insert if str(r.get("plan_date", "")) >= today_iso
        ]

    inserted_rows = 0
    if rows_to_insert:
        inserted_rows = db_insert_daily_rows(rows_to_insert, ctx=ctx)

    return {
        "ok": True,
        "daily_plan": ai_plan,
        "week_index": week_index,
        "week_start": ai_plan.get("week_start") or week_meta.get("week_start"),
        "week_end": ai_plan.get("week_end") or week_meta.get("week_end"),
        "state_id": (state_row or {}).get("id"),
        "model": model_used,
        "overwrite": True,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "error": None,
    }


# ============================================================
# READ
# ============================================================

def service_get_daily_overview(
    user_id: int,
    horizon_days: int = 7,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Načíta denný prehľad tréningov pre daný horizont."""
    if horizon_days <= 0:
        horizon_days = 7

    rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id, horizon_days=horizon_days, ctx=ctx
        )
        or []
    )

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        d = r.get("plan_date")
        if not d:
            continue
        key = str(d)[:10]
        by_date.setdefault(key, []).append(r)

    today = date.today()
    end_day = today + timedelta(days=horizon_days)
    days_out: List[Dict[str, Any]] = []

    d = today
    while d <= end_day:
        date_str = d.isoformat()
        sessions = by_date.get(date_str, [])
        sessions_out: List[Dict[str, Any]] = []

        for s in sorted(sessions, key=lambda x: int(x.get("session_index") or 0)):
            payload = s.get("payload") or {}
            structure = s.get("structure") or payload.get("structure")
            if structure is None:
                strength_ex = s.get("strength_exercises") or payload.get("strength_exercises")
                if strength_ex:
                    structure = {"strength_exercises": strength_ex}
            sessions_out.append({
                "id": s.get("id"),
                "plan_date": str(s.get("plan_date") or "")[:10],
                "session_index": int(s.get("session_index") or 0),
                "sport": s.get("sport") or "other",
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "notes": s.get("notes"),
                "session_type": s.get("session_type"),
                "structure": structure,
                "payload": payload,
                "status": s.get("status"),
                "activity_id": s.get("activity_id"),
            })

        days_out.append({"date": date_str, "sessions": sessions_out})
        d += timedelta(days=1)

    return {"horizon_days": horizon_days, "days": days_out}


# ============================================================
# AUTO EXTEND
# ============================================================

def service_auto_extend_daily_plan(
    user_id: int,
    *,
    min_horizon_days: int = 4,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Automaticky rozšíri denný plán ak zostáva menej ako min_horizon_days dní.
    Pri aktuálnom týždni zachová odtrénované dni (drop_past_days=True).
    """
    if min_horizon_days <= 0:
        min_horizon_days = 6

    today = date.today()

    daily_rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id, horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS, ctx=ctx
        )
        or []
    )
    if not daily_rows:
        return {"changed": False, "reason": "no_daily_rows"}

    last_date_str = max(
        str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
    )
    last_date = date.fromisoformat(last_date_str)
    days_left = (last_date - today).days

    if days_left >= min_horizon_days:
        return {
            "changed": False,
            "reason": "enough_horizon",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    weekly_rows: List[Dict[str, Any]] = (
        db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx) or []
    )
    if not weekly_rows:
        return {
            "changed": False,
            "reason": "no_weekly_rows",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    weekly_sorted = sorted(weekly_rows, key=lambda w: int(w.get("week_index") or 0))

    current_week_index: Optional[int] = None
    target_weeks: List[int] = []

    for w in weekly_sorted:
        ws_raw = w.get("week_start")
        we_raw = w.get("week_end") or ws_raw
        if not isinstance(ws_raw, str) or not isinstance(we_raw, str):
            continue
        try:
            ws = date.fromisoformat(ws_raw[:10])
            we = date.fromisoformat(we_raw[:10])
        except Exception:
            continue

        if ws <= last_date <= we:
            current_week_index = int(w.get("week_index") or 0)
            # Ak v tomto týždni ešte ostali dni po last_date, doplň ich
            if we > last_date:
                target_weeks.append(current_week_index)
        elif ws > last_date:
            target_weeks.append(int(w.get("week_index") or 0))

    if not target_weeks:
        return {
            "changed": False,
            "reason": "no_future_weeks_needed",
            "current_week_index": current_week_index,
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    generated: List[int] = []
    current_last_str = last_date_str

    for week_idx in target_weeks:
        is_current_week = week_idx == current_week_index
        res = service_generate_daily_week(
            user_id=user_id,
            week_index=week_idx,
            model=None,
            drop_past_days=is_current_week,
            reason="refill_auto_extend",
            ctx=ctx,
        )
        if res.get("ok"):
            generated.append(week_idx)

        # Refresh days_left po každom generovaní
        daily_rows = (
            db_list_daily_for_user_horizon(
                user_id=user_id, horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS, ctx=ctx
            )
            or []
        )
        if daily_rows:
            current_last_str = max(
                str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
            )
            days_left = (date.fromisoformat(current_last_str) - today).days
            if days_left >= min_horizon_days:
                break

    return {
        "changed": bool(generated),
        "generated_weeks": generated,
        "current_week_index": current_week_index,
        "final_days_left": days_left,
        "last_daily_date": current_last_str,
    }


# ============================================================
# SESSION STATUS UPDATE
# ============================================================

def service_update_daily_session_status(
    user_id: int,
    session_id: int,
    status: Optional[str],
    activity_id: Optional[int],
    unmatch: bool,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Spracuje manuálne zásahy do denného tréningu: Postpone, Match, Unmatch.
    """
    update_data: Dict[str, Any] = {}

    if unmatch:
        update_data["activity_id"] = None
        update_data["status"] = "planned"
    else:
        if activity_id is not None:
            update_data["activity_id"] = activity_id
            update_data["status"] = "done"
        if status is not None:
            update_data["status"] = status

    if not update_data:
        return {"success": True, "data": None, "message": "No changes requested"}

    row = db_update_daily_session_data(
        user_id=user_id, session_id=session_id, update_data=update_data, ctx=ctx
    )
    if not row:
        raise ValueError("Session not found or update failed")

    return {"success": True, "data": row, "message": "Session updated successfully"}