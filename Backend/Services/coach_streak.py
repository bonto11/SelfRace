# ─── Services/coach_streak.py — aktualizovaná verzia ─────────────────────────
# Streak teraz vychádza z reálnych aktivít (activities_summary), NIE z plánu.
# Funguje teda aj bez aktívneho tréningového plánu.
from __future__ import annotations
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List

from DB.activities_summary import db_get_activities_for_streak
from Modules.Supabase.auth import AuthCtx

 
MIN_SESSIONS_PER_WEEK: int = 3
MIN_DURATION_S: int        = 20 * 60   # 20 minút v sekundách
 
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
    last      = qualifying_weeks[-1]
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
    Týždenný tréningový streak z reálnych aktivít (activities_summary).
    Týždeň počíta ak má >= 3 aktivity, každá >= 20 minút.
    Nezávisí od aktívneho tréningového plánu.
    """
   
    activities = db_get_activities_for_streak(user_id, ctx=ctx)
    today         = date.today()
    current_week  = _week_start(today)
 
    week_buckets: Dict[date, List[int]] = defaultdict(list)
    for act in activities:
        d_raw = act.get("date")
        t_s   = int(act.get("moving_time_s") or 0)
        if not d_raw:
            continue
        try:
            d = date.fromisoformat(str(d_raw)[:10])
            week_buckets[_week_start(d)].append(t_s)
        except Exception:
            continue
 
    qualifying = [
        wk for wk, times in week_buckets.items()
        if len([t for t in times if t >= MIN_DURATION_S]) >= MIN_SESSIONS_PER_WEEK
    ]
    streaks = _calc_streak(qualifying, current_week)
 
    this_week_all  = week_buckets.get(current_week, [])
    this_week_done = len([t for t in this_week_all if t >= MIN_DURATION_S])
 
    return {
        "current_streak":        streaks["current_streak"],
        "best_streak":           streaks["best_streak"],
        "this_week_done":        this_week_done,
        "min_sessions_per_week": MIN_SESSIONS_PER_WEEK,
        "min_duration_min":      MIN_DURATION_S // 60,
    }
 