# Services/coach_plan_completion.py
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

from DB.coach_plan_meta import db_get_active_plan_meta_for_user, db_archive_plan_meta
from DB.coach_plan_weekly import db_get_weekly_for_user_plan
from DB.coach_plan_daily import (
    db_get_last_planned_daily_session_for_user,
    db_get_compliance_stats,
    db_get_unmatched_activities,
)
from DB.coach_plan_summaries import (
    db_insert_plan_summary,
    db_get_summary_exists_for_plan,
)
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.AI.plan_completion.generate import service_generate_plan_completion_summary


RACE_GOAL_KM: Dict[str, float] = {
    "5k": 5.0,
    "10k": 10.0,
    "half": 21.0975,
    "marathon": 42.195,
}

DISTANCE_TOLERANCE_PCT = 0.10  # ±10 %

SPORT_DISPLAY_ORDER: Dict[str, int] = {"run": 0, "ride": 1, "swim": 2, "strength": 3, "other": 4}

PLAN_SPORT_FIELDS: Dict[str, Dict[str, Any]] = {
    "run": {"distance_key": "run_distance_km", "distance_unit_div": 1.0, "time_key": "run_time_min"},
    "ride": {"distance_key": "bike_distance_km", "distance_unit_div": 1.0, "time_key": "bike_time_min"},
    "swim": {"distance_key": "swim_distance_m", "distance_unit_div": 1000.0, "time_key": "swim_time_min"},
    "strength": {"distance_key": None, "distance_unit_div": None, "time_key": "strength_time_min"},
}


# ============================================================
# RACE HELPERS
# ============================================================

def _target_distance_km(race: Dict[str, Any]) -> Optional[float]:
    custom = race.get("custom_distance_km")
    if isinstance(custom, (int, float)) and custom > 0:
        return float(custom)

    goal = race.get("race_goal")
    if goal in RACE_GOAL_KM:
        return RACE_GOAL_KM[goal]

    return None


def _all_races(prefs: Dict[str, Any]) -> List[Dict[str, Any]]:
    targets = prefs.get("targets") or {}
    run_targets = targets.get("run") or {}
    races = run_targets.get("races") or []
    return [r for r in races if isinstance(r, dict)]


def _find_matching_race(
    prefs: Dict[str, Any],
    activity_date_iso: str,
    activity_distance_km: float,
) -> Optional[Dict[str, Any]]:
    act_date_only = str(activity_date_iso)[:10]

    for race in _all_races(prefs):
        race_date = race.get("date")
        if not race_date or str(race_date)[:10] != act_date_only:
            continue

        target_km = _target_distance_km(race)
        if not target_km:
            continue

        diff_ratio = abs(activity_distance_km - target_km) / target_km
        if diff_ratio > DISTANCE_TOLERANCE_PCT:
            continue

        return race

    return None


def _pick_primary_race(prefs: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    races = _all_races(prefs)
    if not races:
        return None
    priority_order: Dict[str, int] = {"A": 0, "B": 1, "C": 2, "D": 3}
    races_sorted = sorted(
        races,
        key=lambda r: priority_order.get(str(r.get("priority") or ""), 99),
    )
    return races_sorted[0]


# ============================================================
# END-OF-PLAN HELPER (nezávislé od preteku)
# ============================================================

def _is_last_plan_session_match(
    user_id: int,
    plan_meta_id: Optional[int],
    activity_date_iso: str,
    *,
    ctx: AuthCtx,
) -> bool:
    """
    FIX (ROOT CAUSE): posledná session sa teraz hľadá SCOPED na
    plan_meta_id tohto konkrétneho (aktívneho) plánu, nie naprieč
    všetkými plánmi usera. Predtým, keď mal user rozbehnutý nedokončený
    draft s neskoršími dátumami, táto funkcia našla poslednú session
    z DRAFTU (nie z aktívneho plánu), takže sa aktívny plán nikdy
    neoznačil za dokončený, aj keď reálne bol.
    """
    last_session = db_get_last_planned_daily_session_for_user(user_id, plan_meta_id, ctx=ctx)
    if not last_session:
        return False

    last_plan_date = str(last_session.get("plan_date") or "")[:10]
    act_date_only = str(activity_date_iso)[:10]

    return bool(last_plan_date) and last_plan_date == act_date_only


# ============================================================
# STATS AGGREGATION (z coach_plan_weekly - len napárované session)
# ============================================================

def _aggregate_weekly_stats(weeks: List[Dict[str, Any]]) -> Dict[str, Any]:
    final_planned: Dict[str, float] = {}
    final_actual: Dict[str, float] = {}

    for w in weeks:
        ps = w.get("planned_stats") or {}
        as_ = w.get("actual_stats") or {}
        for k, v in ps.items():
            final_planned[k] = final_planned.get(k, 0) + (v or 0)
        for k, v in as_.items():
            final_actual[k] = final_actual.get(k, 0) + (v or 0)

    for k in final_planned:
        if isinstance(final_planned[k], float):
            final_planned[k] = round(final_planned[k], 2)
    for k in final_actual:
        if isinstance(final_actual[k], float):
            final_actual[k] = round(final_actual[k], 2)

    return {"planned": final_planned, "actual": final_actual}


def _group_plan_stats_by_sport(actual_totals: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for sport, cfg in PLAN_SPORT_FIELDS.items():
        time_min = float(actual_totals.get(cfg["time_key"]) or 0)
        distance_km = 0.0
        if cfg["distance_key"]:
            raw = float(actual_totals.get(cfg["distance_key"]) or 0)
            distance_km = raw / cfg["distance_unit_div"]

        if not time_min and not distance_km:
            continue

        avg_pace = None
        avg_speed_kmh = None
        if sport == "run" and distance_km > 0:
            avg_pace = round((time_min * 60) / distance_km)
        elif sport == "ride" and time_min > 0:
            avg_speed_kmh = round(distance_km / (time_min / 60.0), 1)

        out.append({
            "sport": sport,
            "distance_km": round(distance_km, 2) if distance_km else 0.0,
            "time_min": round(time_min, 1) if time_min else 0.0,
            "avg_pace_s_per_km": avg_pace,
            "avg_speed_kmh": avg_speed_kmh,
            "avg_hr_bpm": None,
        })

    out.sort(key=lambda x: SPORT_DISPLAY_ORDER.get(x["sport"], 99))
    return out


def _merge_by_sport(
    plan_by_sport: List[Dict[str, Any]],
    unmatched_by_sport: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}

    for row in plan_by_sport:
        merged[row["sport"]] = {
            "distance_km": row.get("distance_km", 0.0),
            "time_min": row.get("time_min", 0.0),
            "hr_weighted_sum": 0.0,
            "hr_weight": 0,
        }

    for row in unmatched_by_sport:
        s = row["sport"]
        m = merged.setdefault(s, {"distance_km": 0.0, "time_min": 0.0, "hr_weighted_sum": 0.0, "hr_weight": 0})
        m["distance_km"] += row.get("total_distance_km", 0.0)
        m["time_min"] += row.get("total_time_min", 0.0)
        if row.get("avg_hr_bpm") and row.get("count"):
            m["hr_weighted_sum"] += row["avg_hr_bpm"] * row["count"]
            m["hr_weight"] += row["count"]

    out: List[Dict[str, Any]] = []
    for sport, m in merged.items():
        avg_pace = None
        avg_speed_kmh = None
        if sport == "run" and m["distance_km"] > 0:
            avg_pace = round((m["time_min"] * 60) / m["distance_km"])
        elif sport == "ride" and m["time_min"] > 0:
            avg_speed_kmh = round(m["distance_km"] / (m["time_min"] / 60.0), 1)
        avg_hr = round(m["hr_weighted_sum"] / m["hr_weight"]) if m["hr_weight"] > 0 else None

        out.append({
            "sport": sport,
            "distance_km": round(m["distance_km"], 2),
            "time_min": round(m["time_min"], 1),
            "avg_pace_s_per_km": avg_pace,
            "avg_speed_kmh": avg_speed_kmh,
            "avg_hr_bpm": avg_hr,
        })

    out.sort(key=lambda x: SPORT_DISPLAY_ORDER.get(x["sport"], 99))
    return out


# ============================================================
# UNMATCHED ACTIVITIES AGGREGATION
# ============================================================

def _canonical_sport(s: Any) -> str:
    if not s:
        return "other"
    v = str(s).lower()
    if "run" in v or v.startswith("trail"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if "swim" in v:
        return "swim"
    if "strength" in v or "gym" in v or "weight" in v:
        return "strength"
    return "other"


def _aggregate_unmatched_activities(
    *, user_id: int, plan_meta_id: Optional[int], ctx: AuthCtx
) -> Dict[str, Any]:
    """Agreguje Strava aktivity, ktoré NIE SÚ napárované na žiadnu naplánovanú session TOHTO plánu."""
    raw = db_get_unmatched_activities(user_id, plan_meta_id, ctx=ctx, days=180)

    if not raw:
        return {"count": 0, "total_distance_km": 0.0, "total_time_min": 0.0, "by_sport": []}

    buckets: Dict[str, Dict[str, Any]] = {}
    overall_distance_m = 0.0
    overall_time_s = 0.0

    for a in raw:
        sport = _canonical_sport(a.get("sport_type_fe") or a.get("sport_type"))
        b = buckets.setdefault(sport, {
            "sport": sport,
            "count": 0,
            "distance_m_sum": 0.0,
            "moving_time_s_sum": 0.0,
            "hr_sum": 0.0,
            "hr_count": 0,
        })
        b["count"] += 1

        dist_m = 0.0
        try:
            dist_m = float(a.get("distance_m") or 0)
            b["distance_m_sum"] += dist_m
            overall_distance_m += dist_m
        except (TypeError, ValueError):
            pass

        time_s = 0.0
        try:
            time_s = float(a.get("moving_time_s") or 0)
            b["moving_time_s_sum"] += time_s
            overall_time_s += time_s
        except (TypeError, ValueError):
            pass

        hr = a.get("average_heartrate_bpm")
        if hr:
            try:
                b["hr_sum"] += float(hr)
                b["hr_count"] += 1
            except (TypeError, ValueError):
                pass

    by_sport: List[Dict[str, Any]] = []
    for b in buckets.values():
        dist_km = round(b["distance_m_sum"] / 1000.0, 2) if b["distance_m_sum"] else 0.0
        time_min = round(b["moving_time_s_sum"] / 60.0, 1) if b["moving_time_s_sum"] else 0.0
        avg_pace = (
            round(b["moving_time_s_sum"] / (b["distance_m_sum"] / 1000.0))
            if b["distance_m_sum"] > 0 and b["sport"] == "run"
            else None
        )
        avg_speed_kmh = (
            round((b["distance_m_sum"] / 1000.0) / (b["moving_time_s_sum"] / 3600.0), 1)
            if b["moving_time_s_sum"] > 0 and b["sport"] == "ride"
            else None
        )
        avg_hr = round(b["hr_sum"] / b["hr_count"]) if b["hr_count"] > 0 else None
        by_sport.append({
            "sport": b["sport"],
            "count": b["count"],
            "total_distance_km": dist_km,
            "total_time_min": time_min,
            "avg_pace_s_per_km": avg_pace,
            "avg_speed_kmh": avg_speed_kmh,
            "avg_hr_bpm": avg_hr,
        })
    by_sport.sort(key=lambda x: SPORT_DISPLAY_ORDER.get(x["sport"], 99))

    return {
        "count": len(raw),
        "total_distance_km": round(overall_distance_m / 1000.0, 2) if overall_distance_m else 0.0,
        "total_time_min": round(overall_time_s / 60.0, 1) if overall_time_s else 0.0,
        "by_sport": by_sport,
    }


# ============================================================
# HARD STATS (deterministicky, bez AI)
# ============================================================

def _compute_hard_stats(
    *,
    user_id: int,
    plan_meta_id: Optional[int],
    elapsed_weeks: List[Dict[str, Any]],
    aggregated: Dict[str, Any],
    unmatched_activities: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    weeks_tracked = len(elapsed_weeks)

    compliance = db_get_compliance_stats(user_id, plan_meta_id, ctx=ctx)
    done = int(compliance.get("done") or 0)
    missed = int(compliance.get("missed") or 0)
    postponed = int(compliance.get("postponed") or 0)
    planned = int(compliance.get("planned") or 0)
    total_sessions = done + missed + postponed
    completion_pct = round((done / total_sessions) * 100, 1) if total_sessions > 0 else None

    actual_totals = aggregated.get("actual") or {}
    planned_totals = aggregated.get("planned") or {}

    total_time_min = sum(
        v for k, v in actual_totals.items()
        if isinstance(v, (int, float)) and k.endswith("_time_min")
    )
    avg_session_duration_min = round(total_time_min / done, 1) if done > 0 else None

    plan_by_sport = _group_plan_stats_by_sport(actual_totals)
    combined_by_sport = _merge_by_sport(plan_by_sport, unmatched_activities.get("by_sport", []))

    return {
        "weeks_tracked": weeks_tracked,
        "compliance": {
            "done": done,
            "missed": missed,
            "postponed": postponed,
            "planned_remaining": planned,
            "completion_pct": completion_pct,
        },
        "plan_stats": {
            "by_sport": plan_by_sport,
            "avg_session_duration_min": avg_session_duration_min,
        },
        "unmatched_stats": {
            "count": unmatched_activities.get("count", 0),
            "by_sport": unmatched_activities.get("by_sport", []),
        },
        "combined_stats": {
            "by_sport": combined_by_sport,
        },
        "planned_totals": planned_totals,
        "actual_totals": actual_totals,
    }


# ============================================================
# SHARED BUILDER
# ============================================================

def _build_and_save_summary(
    *,
    user_id: int,
    meta: Dict[str, Any],
    matching_race: Optional[Dict[str, Any]],
    activity: Optional[Dict[str, Any]],
    trigger_type: str,
    is_plan_completed: bool,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    meta_id = meta.get("id")

    weeks = db_get_weekly_for_user_plan(user_id=user_id, plan_meta_id=meta_id, ctx=ctx)
    aggregated = _aggregate_weekly_stats(weeks)
    prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)

    activity_date = activity.get("date") if activity else None
    distance_m = activity.get("distance_m") if activity else None
    moving_time_s = activity.get("moving_time_s") if activity else None

    activity_distance_km = float(distance_m) / 1000.0 if distance_m else None
    actual_time_s = int(moving_time_s) if moving_time_s else None
    target_km = _target_distance_km(matching_race) if matching_race else None

    today_iso = date.today().isoformat()

    def _week_end_str(w: Dict[str, Any]) -> str:
        return str(w.get("week_end") or "")[:10]

    elapsed_weeks = [w for w in weeks if _week_end_str(w) and _week_end_str(w) <= today_iso]
    future_weeks_count = len(weeks) - len(elapsed_weeks)

    unmatched_activities = _aggregate_unmatched_activities(user_id=user_id, plan_meta_id=meta_id, ctx=ctx)

    hard_stats = _compute_hard_stats(
        user_id=user_id,
        plan_meta_id=meta_id,
        elapsed_weeks=elapsed_weeks,
        aggregated=aggregated,
        unmatched_activities=unmatched_activities,
        ctx=ctx,
    )

    summary_row: Dict[str, Any] = {
        "user_id": user_id,
        "plan_meta_id": meta_id,
        "activity_id": activity.get("activity_id") if activity else None,
        "race_name": matching_race.get("name") if matching_race else None,
        "race_date": str(activity_date)[:10] if activity_date else (
            str(matching_race.get("date"))[:10] if matching_race and matching_race.get("date") else None
        ),
        "race_target_time": matching_race.get("target_time") if matching_race else None,
        "race_actual_time_s": actual_time_s,
        "race_target_distance_km": target_km,
        "race_actual_distance_km": round(activity_distance_km, 2) if activity_distance_km else None,
        "weeks_tracked": len(weeks),
        "planned_stats": aggregated["planned"],
        "actual_stats": aggregated["actual"],
        "hard_stats": hard_stats,
        "trigger_type": trigger_type,
        "is_plan_completed": is_plan_completed,
    }

    try:
        ai_out = service_generate_plan_completion_summary(
            user_id=user_id,
            race=matching_race,
            goal_kind=prefs.get("goal_kind"),
            plan_start_date=meta.get("start_date"),
            plan_end_date=meta.get("end_date"),
            weeks_total=meta.get("weeks_total"),
            aggregated=aggregated,
            weeks=elapsed_weeks,
            future_weeks_count=future_weeks_count,
            today_iso=today_iso,
            unmatched_activities=unmatched_activities,
            actual_time_s=actual_time_s,
            target_km=target_km,
            actual_km=activity_distance_km,
            is_plan_completed=is_plan_completed,
            ctx=ctx,
        )
        if ai_out.get("ok"):
            ai_data = ai_out.get("data") or {}
            summary_row["ai_headline"] = ai_data.get("headline")
            summary_row["ai_summary_text"] = ai_data.get("summary_text")
            summary_row["raw_ai_json"] = ai_data
        else:
            print(f"[PLAN_COMPLETION] AI generation not ok user_id={user_id}: {ai_out}")
    except Exception as e:  # noqa: BLE001
        print(f"[PLAN_COMPLETION] AI narrative generation failed user_id={user_id}: {repr(e)}")

    saved = db_insert_plan_summary(summary_row, ctx=ctx)

    if is_plan_completed and meta_id:
        try:
            fallback_ended_at = datetime.now(timezone.utc).isoformat()
            db_archive_plan_meta(
                user_id=user_id,
                meta_id=int(meta_id),
                new_status="completed",
                final_stats={
                    "weeks_tracked": len(weeks),
                    "weeks_total_planned": meta.get("weeks_total"),
                    "final_planned_stats": aggregated["planned"],
                    "final_actual_stats": aggregated["actual"],
                },
                ended_at=str(activity_date) if activity_date else fallback_ended_at,
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[PLAN_COMPLETION] archive_plan_meta failed user_id={user_id}: {repr(e)}")

    return saved


# ============================================================
# ENTRYPOINT A: AUTOMATICKÁ DETEKCIA (volaná z importu aktivity)
# ============================================================

def service_check_and_generate_plan_summary(
    *,
    user_id: int,
    activity: Dict[str, Any],
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or meta.get("status") != "active":
        return None

    meta_id = meta.get("id")
    if not meta_id:
        return None

    if db_get_summary_exists_for_plan(plan_meta_id=meta_id, ctx=ctx):
        return None

    activity_date = activity.get("date")
    distance_m = activity.get("distance_m")
    if not activity_date:
        return None

    prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)

    matching_race: Optional[Dict[str, Any]] = None
    if distance_m:
        activity_distance_km = float(distance_m) / 1000.0
        matching_race = _find_matching_race(prefs, str(activity_date), activity_distance_km)

    # FIX: teraz scoped na tento konkrétny meta_id - pozri docstring
    # _is_last_plan_session_match vyššie.
    is_last_session = _is_last_plan_session_match(user_id, meta_id, str(activity_date), ctx=ctx)

    if not matching_race and not is_last_session:
        return None

    trigger_type = "race_match" if matching_race else "last_session_match"

    return _build_and_save_summary(
        user_id=user_id,
        meta=meta,
        matching_race=matching_race,
        activity=activity,
        trigger_type=trigger_type,
        is_plan_completed=True,
        ctx=ctx,
    )


# ============================================================
# ENTRYPOINT B: MANUÁLNY "MILESTONE" SUMÁR (volaný z FE, kedykoľvek)
# ============================================================

def service_generate_milestone_summary_on_demand(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or meta.get("status") != "active":
        return {"ok": False, "reason": "no_active_plan"}

    prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)
    primary_race = _pick_primary_race(prefs)

    saved = _build_and_save_summary(
        user_id=user_id,
        meta=meta,
        matching_race=primary_race,
        activity=None,
        trigger_type="manual",
        is_plan_completed=False,
        ctx=ctx,
    )

    if not saved:
        return {"ok": False, "reason": "save_failed"}

    return {"ok": True, "data": saved}