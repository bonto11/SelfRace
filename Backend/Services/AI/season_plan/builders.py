# Services/AI/season_plan/builders.py
"""
Kontext pre AI kostru obdobia (advisor režim).

ČO SEM PATRÍ: čo user chce dosiahnuť (jeho text), od kedy a na koľko
týždňov, jeho športy a možnosti (čas, vybavenie, silové tréningy), preteky
v období a tesne po ňom, aký je to športovec (posledný athlete state),
aktuálne zdravie a posledné týždne objemu. Konkrétne dni ani tréningy nie –
tie si skladá user sám.

Pomocné bloky sa berú z advisor_review (rovnaký tvar aj pravidlá).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from Services.AI.advisor_review.builders import (
    _build_health_block,
    _build_state_block,
    _weekday,
)
from Services.season_plan import monday_of

REQUEST_MAX = 1500
# preteky tesne po období – plán k nim má viesť (napr. od januára príprava)
RACES_AFTER_WEEKS = 8


def _clean(raw: Any, limit: int = REQUEST_MAX) -> Optional[str]:
    s = str(raw or "").strip()
    return s[:limit] if s else None


def _races_block(prefs: Dict[str, Any], *, start: date, end: date, lang: str) -> List[Dict[str, Any]]:
    run = ((prefs.get("targets") or {}).get("run") or {})
    out: List[Dict[str, Any]] = []
    horizon = end + timedelta(weeks=RACES_AFTER_WEEKS)
    for r in run.get("races") or []:
        if not isinstance(r, dict):
            continue
        try:
            d = date.fromisoformat(str(r.get("date") or r.get("start_date") or "")[:10])
        except ValueError:
            continue
        if not (start <= d <= horizon):
            continue
        out.append({
            "name": r.get("name"),
            "date": d.isoformat(),
            "weekday": _weekday(d, lang),
            # číslo týždňa v kostre (1 = prvý), za koncom = after_plan
            "plan_week": ((d - start).days // 7 + 1) if d <= end else None,
            "after_plan": d > end,
            "distance_km": r.get("custom_distance_km"),
            "elevation_gain_m": r.get("elevation_gain_m"),
            "terrain": r.get("terrain"),
            "priority": r.get("priority"),
            "target_time": r.get("target_time"),
        })
    out.sort(key=lambda x: x["date"])
    return out


def _recent_weeks_block(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Objem posledných uzavretých týždňov – AI má vedieť, odkiaľ kostra štartuje."""
    try:
        from Services.analytics_RecentLoad import service_build_recent_load_raw

        rl = service_build_recent_load_raw(user_id=user_id, window_days=42, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[SEASON][builder] recent load failed: {repr(e)}")
        return []
    out: List[Dict[str, Any]] = []
    for w in rl.get("weeks") or []:
        if not isinstance(w, dict) or int(w.get("week_index_from_now") or 0) >= 0:
            continue
        out.append({
            "weeks_ago": -int(w.get("week_index_from_now") or 0),
            "total_minutes": round(float(w.get("total_minutes") or 0)),
            "run_minutes": round(float(w.get("run_minutes") or 0)),
            "strength_sessions": w.get("strength_sessions") or 0,
            # heuristika RecentLoad: beh ≥ 60 min
            "runs_60min_plus": w.get("hard_sessions") or 0,
        })
    out.sort(key=lambda x: x["weeks_ago"])
    return out


def _plan_for_ai(plan: Any) -> Optional[Dict[str, Any]]:
    """Plán, ktorý má AI upraviť – bez dátumov a interných polí."""
    if not isinstance(plan, dict) or not plan.get("weeks"):
        return None
    weeks = []
    for w in plan.get("weeks") or []:
        if not isinstance(w, dict):
            continue
        item = {k: v for k, v in w.items() if k not in ("start_date",) and v not in (None, [], "")}
        if "notes" in item:
            item["athlete_note"] = item.pop("notes")
        weeks.append(item)
    return {
        "title": plan.get("title"),
        "goal_summary": plan.get("goal_summary"),
        "principles": plan.get("principles") or [],
        "weeks": weeks,
    }


def _thread_for_ai(thread: Any) -> List[Dict[str, Any]]:
    """Predošlé kolá z FE – len texty, plán ide zvlášť ako current_plan."""
    if not isinstance(thread, list):
        return []
    out: List[Dict[str, Any]] = []
    for e in thread[-6:]:
        if not isinstance(e, dict):
            continue
        if e.get("role") == "user":
            t = _clean(e.get("text"), 600)
            if t:
                out.append({"role": "athlete", "text": t})
        elif e.get("role") == "assistant":
            t = _clean(e.get("reply_text"), 800)
            if t:
                out.append({"role": "coach", "reply_text": t})
    return out


def build_season_plan_input(
    user_id: int,
    *,
    start_date: date,
    weeks: int,
    request: Optional[str],
    thread: Any,
    current_plan: Any,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    from Services.AI.utils.training_focus import load_widget_profile
    from Services.user_prefs import service_load_coach_prefs_for_analysis, service_load_user_settings

    try:
        settings = service_load_user_settings(user_id=user_id, ctx=ctx) or {}
    except Exception:  # noqa: BLE001
        settings = {}
    lang = str(settings.get("language") or "sk").lower()[:2]
    lang = lang if lang in ("sk", "cs", "en") else "sk"

    try:
        prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[SEASON][builder] prefs failed: {repr(e)}")
        prefs = {}

    start = monday_of(start_date)
    end = start + timedelta(days=7 * weeks - 1)
    strength = prefs.get("strength_settings") if isinstance(prefs.get("strength_settings"), dict) else {}
    pref_block = prefs.get("preferences") if isinstance(prefs.get("preferences"), dict) else {}

    ctx_out: Dict[str, Any] = {
        "today": date.today().isoformat(),
        "period": {"start": start.isoformat(), "end": end.isoformat(), "weeks": weeks},
        "athlete_request": _clean(request),
        "conversation": _thread_for_ai(thread),
        "current_plan": _plan_for_ai(current_plan),
        "athlete": {
            "main_sport": prefs.get("main_sport"),
            "add_on_sports": prefs.get("add_on_sports"),
            "goal_kind": prefs.get("goal_kind"),
            "training_focus": load_widget_profile(user_id, ctx=ctx),
            "volume": prefs.get("volume"),
            "days_off": pref_block.get("days_off") or [],
            "strength_sessions_per_week": strength.get("sessions_per_week"),
            "strength_level": strength.get("experience_level"),
            "strength_location": strength.get("location"),
            "strength_equipment": strength.get("available"),
            "injuries": prefs.get("injuries"),
        },
        "races": _races_block(prefs, start=start, end=end, lang=lang),
        "recent_weeks": _recent_weeks_block(user_id, ctx=ctx),
        "athlete_state": _build_state_block(user_id, ctx=ctx),
        "health_records": _build_health_block(user_id, ctx=ctx),
    }

    user: Dict[str, Any] = {}
    try:
        from DB.users import db_get_user_display_name

        name = db_get_user_display_name(user_id, ctx=ctx)
        if name:
            user["first_name"] = name
    except Exception:  # noqa: BLE001
        pass
    if prefs.get("gender") in ("male", "female"):
        user["gender"] = prefs.get("gender")

    return {"lang": lang, "settings": settings, "user": user, "context": ctx_out}
