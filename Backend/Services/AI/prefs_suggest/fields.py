# Services/AI/prefs_suggest/fields.py
"""
Polia coach prefs, ktoré smie AI navrhnúť zmeniť, a ich kontrola.

PREČO whitelist: AI navrhuje zmeny do nastavení, z ktorých sa generuje
plán – neznáme pole alebo hodnota mimo rozsahu by rozbila formulár aj
generátor. Režim (coach/advisor), preteky, zóny, prahy a vybavenie AI
nemení: to sú fakty alebo vedomé rozhodnutia usera (AI ich len spomenie
v `todo`).
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional, Tuple

DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
SPORTS = ("run", "ride", "swim")
GOALS = ("lose_weight", "health", "improve_speed", "improve_endurance", "improve_overall", "maintain")
STRENGTH_GOALS = ("max_strength", "hypertrophy", "strength_endurance", "power", "general_resilience")

_MISSING = object()


def _enum(allowed) -> Callable[[Any], Any]:
    def f(v: Any) -> Any:
        return v if v in allowed else _MISSING
    return f


def _int(lo: int, hi: int) -> Callable[[Any], Any]:
    def f(v: Any) -> Any:
        try:
            n = int(round(float(v)))
        except (TypeError, ValueError):
            return _MISSING
        return n if lo <= n <= hi else _MISSING
    return f


def _bool(v: Any) -> Any:
    return v if isinstance(v, bool) else _MISSING


def _days(v: Any) -> Any:
    if not isinstance(v, list) or any(d not in DAYS for d in v):
        return _MISSING
    return [d for d in DAYS if d in v]


def _sports(v: Any) -> Any:
    if not isinstance(v, list) or any(s not in SPORTS for s in v):
        return _MISSING
    return [s for s in SPORTS if s in v]


def _volume(v: Any) -> Any:
    if not isinstance(v, dict):
        return _MISSING
    mode = v.get("mode")
    try:
        val = float(v.get("value"))
    except (TypeError, ValueError):
        return _MISSING
    if mode == "weekly_hours" and 1 <= val <= 40:
        return {"mode": mode, "value": round(val * 2) / 2}
    if mode == "daily_minutes" and 15 <= val <= 300:
        return {"mode": mode, "value": int(round(val / 5) * 5)}
    return _MISSING


def _two_a_day(v: Any) -> Any:
    if not isinstance(v, dict) or not isinstance(v.get("enabled"), bool):
        return _MISSING
    try:
        mx = int(v.get("max_days_per_week") or 0)
    except (TypeError, ValueError):
        return _MISSING
    enabled = v["enabled"] and mx > 0
    return {"enabled": enabled, "max_days_per_week": max(0, min(2, mx)) if enabled else 0}


# cesta v coach prefs → kontrola hodnoty
FIELDS: Dict[str, Callable[[Any], Any]] = {
    "goal_kind": _enum(GOALS),
    "main_sport": _enum(SPORTS),
    "add_on_sports": _sports,
    "weeks": _int(1, 52),
    "volume": _volume,
    "preferences.days_off": _days,
    "preferences.long_run_days": _days,
    "preferences.avoid_back_to_back_hard": _bool,
    "preferences.intensity_model": _enum(("polarized", "pyramidal")),
    "preferences.two_a_day": _two_a_day,
    "strength_settings.sessions_per_week": _int(0, 5),
    "strength_settings.session_duration_min": _int(30, 90),
    "strength_settings.goal": _enum(STRENGTH_GOALS),
    "strength_settings.sport_specificity": _enum(("low", "balanced", "high")),
}


def get_path(prefs: Dict[str, Any], path: str) -> Any:
    cur: Any = prefs
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def current_values(prefs: Dict[str, Any]) -> Dict[str, Any]:
    """Aktuálne hodnoty povolených polí – pre AI aj na porovnanie."""
    return {p: get_path(prefs, p) for p in FIELDS}


def validate_change(path: Any, value: Any) -> Tuple[bool, Optional[Any]]:
    check = FIELDS.get(str(path or ""))
    if not check:
        return False, None
    out = check(value)
    return (out is not _MISSING), (None if out is _MISSING else out)
