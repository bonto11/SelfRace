# ─── Services/coach_streak.py ─────────────────────────────────────────────────
from __future__ import annotations
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List
from Modules.Supabase.auth import AuthCtx

from DB.coach_plan_daily import db_get_done_sessions_for_streak

MIN_SESSIONS_PER_WEEK: int = 3
MIN_DURATION_MIN: int      = 20

def _week_start(d: date) -> date:
    """Pondelok týždňa pre daný dátum."""
    return d - timedelta(days=d.weekday())

def _calc_streak(qualifying_weeks: List[date], current_week: date) -> Dict[str, int]:
    """
    Z utriedeného zoznamu qualifying týždňov vypočíta:
    - current_streak: po sebe idúce týždne zakončené aktuálnym / minulým týždňom
    - best_streak: historicky najdlhší streak
    """
    if not qualifying_weeks:
        return {"current_streak": 0, "best_streak": 0}

    qualifying_weeks = sorted(set(qualifying_weeks))

    # Best streak
    best = temp = 1
    for i in range(1, len(qualifying_weeks)):
        if qualifying_weeks[i] - qualifying_weeks[i - 1] == timedelta(weeks=1):
            temp += 1
            best = max(best, temp)
        else:
            temp = 1

    # Current streak — streak musí byť "živý": posledný qualifying týždeň
    # je buď tento týždeň alebo minulý (keďže aktuálny týždeň ešte beží)
    last = qualifying_weeks[-1]
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


def service_get_streak(user_id: int, *, ctx: "AuthCtx") -> Dict[str, Any]:
    """
    Vypočíta týždenný tréningový streak:
    - Týždeň "počíta" ak má >= MIN_SESSIONS_PER_WEEK done sessionov,
      každý >= MIN_DURATION_MIN minút.
    - current_streak: počet po sebe idúcich qualifying týždňov (aktuálny alebo posledný)
    - best_streak: historický max
    - this_week_done: koľko qualifying sessionov tento týždeň
    """

    sessions = db_get_done_sessions_for_streak(user_id, ctx=ctx)
    today = date.today()
    current_week = _week_start(today)

    # Zoskup po týždňoch
    week_buckets: Dict[date, List[int]] = defaultdict(list)
    for s in sessions:
        pd = s.get("plan_date")
        dur = int(s.get("duration_min") or 0)
        if not pd:
            continue
        try:
            d = date.fromisoformat(str(pd)[:10])
            week_buckets[_week_start(d)].append(dur)
        except Exception:
            continue

    # Qualifying týždne
    qualifying: List[date] = [
        wk for wk, durations in week_buckets.items()
        if len([d for d in durations if d >= MIN_DURATION_MIN]) >= MIN_SESSIONS_PER_WEEK
    ]

    streaks = _calc_streak(qualifying, current_week)

    # Progres tohto týždňa
    this_week_all  = week_buckets.get(current_week, [])
    this_week_done = len([d for d in this_week_all if d >= MIN_DURATION_MIN])

    return {
        "current_streak":       streaks["current_streak"],
        "best_streak":          streaks["best_streak"],
        "this_week_done":       this_week_done,
        "min_sessions_per_week": MIN_SESSIONS_PER_WEEK,
        "min_duration_min":     MIN_DURATION_MIN,
    }


