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


# ============================================================
# RACE HELPERS
# ============================================================

def _target_distance_km(race: Dict[str, Any]) -> Optional[float]:
    """
    custom_distance_km je hodnota, ktorú user zadal pri voľbe 'other'/'ultra'
    (frontend GoalSection.tsx). Pri štandardných voľbách (5k/10k/half/
    marathon) je custom_distance_km null a reálna vzdialenosť sa odvodí
    z race_goal -> RACE_GOAL_KM (prepis toho, čo user zvolil kliknutím).
    """
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
    """
    Nájde AKÝKOĽVEK pretek (bez ohľadu na prioritu) z prefs.targets.run.races,
    ktorého dátum sa PRESNE zhoduje s dátumom aktivity a vzdialenosť je v
    tolerancii ±10 %.
    """
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
    """
    Pre manuálny (on-demand) trigger vyberá "hlavný" pretek na zobrazenie -
    uprednostní prioritu A, potom B, C, D..., inak prvý v zozname.
    """
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
    activity_date_iso: str,
    *,
    ctx: AuthCtx,
) -> bool:
    last_session = db_get_last_planned_daily_session_for_user(user_id, ctx=ctx)
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


# ============================================================
# UNMATCHED ACTIVITIES AGGREGATION (Strava aktivity nenapárované na plán)
# ============================================================

def _canonical_sport(s: Any) -> str:
    if not s:
        return "other"
    v = str(s).lower()
    if v in ("run", "trail", "trail_run") or v.startswith("run"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if "swim" in v:
        return "swim"
    if "strength" in v or "gym" in v or "weight" in v:
        return "strength"
    return "other"


def _aggregate_unmatched_activities(
    *, user_id: int, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Agreguje Strava aktivity, ktoré NIE SÚ napárované na žiadnu naplánovanú
    session v coach_plan_daily - za celé obdobie aktívneho plánu.

    Vracia jeden CELKOVÝ súhrn (count, distance, time, avg pace, avg HR) pre
    zobrazenie na FE, plus 'by_sport' breakdown pre AI kontext (užitočnejší
    detail pre naráciu než pre UI).

    Toto je KRITICKÉ pre AI kontext - actual_stats z coach_plan_weekly počíta
    len z napárovaných session, takže ak user trénoval, ale inak než plán
    predpisoval (napr. dlhý beh namiesto intervalov, voľný beh navyše), tie
    kilometre/minúty sa v actual_stats vôbec neobjavia. Bez tejto agregácie
    AI mylne tvrdí "nič si netrénoval", hoci reálne trénoval, len inak.
    """
    raw = db_get_unmatched_activities(user_id, ctx=ctx, days=180)

    if not raw:
        return {
            "count": 0,
            "total_distance_km": 0.0,
            "total_time_min": 0.0,
            "avg_pace_s_per_km": None,
            "avg_hr_bpm": None,
            "by_sport": [],
        }

    buckets: Dict[str, Dict[str, Any]] = {}
    overall_distance_m = 0.0
    overall_time_s = 0.0
    overall_pace_distance_m = 0.0  # len run/ride pre pace priemer
    overall_pace_time_s = 0.0
    overall_hr_sum = 0.0
    overall_hr_count = 0

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

        if sport in ("run", "ride") and dist_m > 0 and time_s > 0:
            overall_pace_distance_m += dist_m
            overall_pace_time_s += time_s

        hr = a.get("average_heartrate_bpm")
        if hr:
            try:
                b["hr_sum"] += float(hr)
                b["hr_count"] += 1
                overall_hr_sum += float(hr)
                overall_hr_count += 1
            except (TypeError, ValueError):
                pass

    by_sport: List[Dict[str, Any]] = []
    for b in buckets.values():
        dist_km = round(b["distance_m_sum"] / 1000.0, 2) if b["distance_m_sum"] else 0.0
        time_min = round(b["moving_time_s_sum"] / 60.0, 1) if b["moving_time_s_sum"] else 0.0
        avg_pace = (
            round(b["moving_time_s_sum"] / (b["distance_m_sum"] / 1000.0))
            if b["distance_m_sum"] > 0 and b["sport"] in ("run", "ride")
            else None
        )
        avg_hr = round(b["hr_sum"] / b["hr_count"]) if b["hr_count"] > 0 else None
        by_sport.append({
            "sport": b["sport"],
            "count": b["count"],
            "total_distance_km": dist_km,
            "total_time_min": time_min,
            "avg_pace_s_per_km": avg_pace,
            "avg_hr_bpm": avg_hr,
        })
    by_sport.sort(key=lambda x: x["count"], reverse=True)

    overall_avg_pace = (
        round(overall_pace_time_s / (overall_pace_distance_m / 1000.0))
        if overall_pace_distance_m > 0
        else None
    )
    overall_avg_hr = round(overall_hr_sum / overall_hr_count) if overall_hr_count > 0 else None

    return {
        "count": len(raw),
        "total_distance_km": round(overall_distance_m / 1000.0, 2) if overall_distance_m else 0.0,
        "total_time_min": round(overall_time_s / 60.0, 1) if overall_time_s else 0.0,
        "avg_pace_s_per_km": overall_avg_pace,
        "avg_hr_bpm": overall_avg_hr,
        "by_sport": by_sport,
    }


# ============================================================
# HARD STATS (deterministicky, bez AI)
# ============================================================

def _compute_hard_stats(
    *,
    user_id: int,
    elapsed_weeks: List[Dict[str, Any]],
    aggregated: Dict[str, Any],
    unmatched_activities: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Deterministicky (bez AI) vypočítané tvrdé čísla k cyklu - compliance,
    súčty a priemery na týždeň. Nezávislé od AI narrácie, počíta sa vždy
    rovnako a presne z DB dát.
    """
    weeks_tracked = len(elapsed_weeks)

    compliance = db_get_compliance_stats(user_id, ctx=ctx)
    done = int(compliance.get("done") or 0)
    missed = int(compliance.get("missed") or 0)
    postponed = int(compliance.get("postponed") or 0)
    planned = int(compliance.get("planned") or 0)
    total_sessions = done + missed + postponed
    completion_pct = round((done / total_sessions) * 100, 1) if total_sessions > 0 else None

    actual_totals = aggregated.get("actual") or {}
    planned_totals = aggregated.get("planned") or {}

    weekly_averages: Dict[str, float] = {}
    if weeks_tracked > 0:
        for k, v in actual_totals.items():
            if isinstance(v, (int, float)):
                weekly_averages[k] = round(v / weeks_tracked, 2)

    total_time_min = sum(
        v for k, v in actual_totals.items()
        if isinstance(v, (int, float)) and k.endswith("_time_min")
    )
    avg_session_duration_min = round(total_time_min / done, 1) if done > 0 else None

    return {
        "weeks_tracked": weeks_tracked,
        "compliance": {
            "done": done,
            "missed": missed,
            "postponed": postponed,
            "planned_remaining": planned,
            "completion_pct": completion_pct,
        },
        "planned_totals": planned_totals,
        "actual_totals": actual_totals,
        "weekly_averages": weekly_averages,
        "avg_session_duration_min": avg_session_duration_min,
        "unmatched_activities": unmatched_activities,
    }


# ============================================================
# SHARED BUILDER (spoločné pre auto aj manuálny trigger)
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

    weeks = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx)
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

    # Nenapárované aktivity - AI musí vidieť, že user reálne trénoval,
    # aj keď to plán "nezapočítal" (napr. dlhé behy namiesto intervalov)
    unmatched_activities = _aggregate_unmatched_activities(user_id=user_id, ctx=ctx)

    # Tvrdé čísla nezávislé od AI
    hard_stats = _compute_hard_stats(
        user_id=user_id,
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

    is_last_session = _is_last_plan_session_match(user_id, str(activity_date), ctx=ctx)

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