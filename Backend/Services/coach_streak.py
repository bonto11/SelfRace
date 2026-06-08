
# ─── Services/coach_streak.py — nahraď service_get_streak ────────────────────
from __future__ import annotations
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List
from DB.activities_summary import db_get_summary_for_activities
from DB.coach_plan_daily import (
        db_get_done_sessions_for_streak,
        db_get_done_sessions_with_activity,
    )
from Modules.Supabase.auth import AuthCtx



MIN_SESSIONS_PER_WEEK: int = 3
MIN_DURATION_MIN: int      = 20

SPORT_DISTANCE_SPORTS = {"run", "running", "ride", "bike", "cycling", "swim", "swimming", "mixed"}

def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())

def _calc_streak(qualifying_weeks: List[date], current_week: date) -> Dict[str, int]:
    if not qualifying_weeks:
        return {"current_streak": 0, "best_streak": 0}

    qualifying_weeks = sorted(set(qualifying_weeks))
    best = temp = 1
    for i in range(1, len(qualifying_weeks)):
        if qualifying_weeks[i] - qualifying_weeks[i - 1] == timedelta(weeks=1):
            temp += 1
            best = max(best, temp)
        else:
            temp = 1

    last     = qualifying_weeks[-1]
    prev_week = current_week - timedelta(weeks=1)
    if last not in (current_week, prev_week):
        return {"current_streak": 0, "best_streak": best}

    current = 1
    for i in range(len(qualifying_weeks) - 2, -1, -1):
        if qualifying_weeks[i + 1] - qualifying_weeks[i] == timedelta(weeks=1):
            current += 1
        else:
            break

    return {"current_streak": current, "best_streak": best}


def _norm_sport(sport: str | None) -> str:
    """Normalizuj sport na FE kľúč."""
    s = (sport or "other").lower().strip()
    if s in ("run", "running"):       return "run"
    if s in ("ride", "bike", "cycling"): return "ride"
    if s in ("swim", "swimming"):     return "swim"
    if s in ("strength",):            return "strength"
    if s in ("mixed",):               return "mixed"
    return "other"


def service_get_streak(user_id: int, *, ctx: "AuthCtx") -> Dict[str, Any]:
    
    
    today        = date.today()
    current_week = _week_start(today)

    # 1) Pre streak — len done sessiony s plan_date + duration
    streak_sessions = db_get_done_sessions_for_streak(user_id, ctx=ctx)

    week_buckets: Dict[date, List[int]] = defaultdict(list)
    for s in streak_sessions:
        pd  = s.get("plan_date")
        dur = int(s.get("duration_min") or 0)
        if not pd:
            continue
        try:
            week_buckets[_week_start(date.fromisoformat(str(pd)[:10]))].append(dur)
        except Exception:
            continue

    qualifying = [
        wk for wk, durs in week_buckets.items()
        if len([d for d in durs if d >= MIN_DURATION_MIN]) >= MIN_SESSIONS_PER_WEEK
    ]
    streaks = _calc_streak(qualifying, current_week)

    this_week_all  = week_buckets.get(current_week, [])
    this_week_done = len([d for d in this_week_all if d >= MIN_DURATION_MIN])

    # 2) Štatistiky po športoch — done sessiony z plánu
    plan_sessions = db_get_done_sessions_with_activity(user_id, ctx=ctx)

    # Zozbieraj activity_ids pre batch fetch
    activity_ids = [
        int(s["activity_id"]) for s in plan_sessions
        if s.get("activity_id") is not None
    ]

    # Actual dáta z aktivít (moving_time_s, distance_m, sport_type_fe)
    activity_map: Dict[int, Dict] = {}
    if activity_ids:
        try:
            act_rows = db_get_summary_for_activities(
                user_id=user_id,
                activity_ids=activity_ids,
                ctx=ctx,
            ) or []
            for row in act_rows:
                aid = row.get("activity_id")
                if aid:
                    activity_map[int(aid)] = row
        except Exception as e:
            print("[STREAK] activity fetch failed:", e)

    # Agreguj po športoch
    sport_time_s:  Dict[str, float] = defaultdict(float)
    sport_dist_m:  Dict[str, float] = defaultdict(float)

    for s in plan_sessions:
        aid      = s.get("activity_id")
        plan_dur = float(s.get("duration_min") or 0) * 60  # → sekundy

        if aid and int(aid) in activity_map:
            act  = activity_map[int(aid)]
            skey = _norm_sport(act.get("sport_type_fe") or s.get("sport"))
            t_s  = float(act.get("moving_time_s") or plan_dur)
            d_m  = float(act.get("distance_m") or 0)
        else:
            # Nenamatchnutý — použi plán
            skey = _norm_sport(s.get("sport"))
            t_s  = plan_dur
            d_m  = 0.0

        sport_time_s[skey] += t_s
        if skey in SPORT_DISTANCE_SPORTS:
            sport_dist_m[skey] += d_m

    # Vráť len nenulové hodnoty, zaokrúhlené
    sport_stats = {}
    for sport in set(list(sport_time_s.keys()) + list(sport_dist_m.keys())):
        t = sport_time_s.get(sport, 0)
        d = sport_dist_m.get(sport, 0)
        if t > 0 or d > 0:
            sport_stats[sport] = {
                "time_s":   round(t),
                "dist_m":   round(d) if d > 0 else None,
            }

    return {
        "current_streak":        streaks["current_streak"],
        "best_streak":           streaks["best_streak"],
        "this_week_done":        this_week_done,
        "min_sessions_per_week": MIN_SESSIONS_PER_WEEK,
        "min_duration_min":      MIN_DURATION_MIN,
        "sport_stats":           sport_stats,
    }