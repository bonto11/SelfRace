# Services/season_plan.py
"""
Plán obdobia (kostra na viac týždňov) – advisor režim.

User napíše, čo chce v najbližších týždňoch dosiahnuť, AI navrhne kostru
po týždňoch (téma, náročnosť, počty tréningov, kľúčové tréningy) a user ju
uloží a upravuje. Konkrétne tréningy si skladá sám – kostra je len mapa,
aby týždne mali nadväznosť.

Uložené v users_preferences pod kľúčom SEASON_PLAN_KEY (jeden aktuálny
plán, nový ho prepíše). PREČO nie vlastná tabuľka: plán je jeden JSON,
história verzií zatiaľ netreba a tréner ho číta cez existujúcu politiku
trainer_read (Backend/sql/season_plan_trainer_read.sql).

Do AI ide cez season_plan_context_for_ai (hodnotenie týždňa, návrh tréningu).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from DB.user_prefs import db_delete_pref_single, db_get_pref_single, db_upsert_pref_single
from Modules.Supabase.auth import AuthCtx

SEASON_PLAN_KEY = "advisor.season_plan"

MIN_WEEKS = 1
MAX_WEEKS = 16
LOADS = ("recovery", "easy", "moderate", "hard")
MAX_KEY_SESSIONS = 5
MAX_PRINCIPLES = 6


def _txt(v: Any, limit: int) -> Optional[str]:
    s = str(v or "").strip()
    return s[:limit] if s else None


def _int(v: Any, lo: int, hi: int) -> Optional[int]:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _parse_date(v: Any) -> Optional[date]:
    try:
        return date.fromisoformat(str(v or "")[:10])
    except ValueError:
        return None


def _str_list(v: Any, limit_items: int, limit_len: int) -> List[str]:
    if not isinstance(v, list):
        return []
    out = [s for s in (_txt(x, limit_len) for x in v) if s]
    return out[:limit_items]


def normalize_week(raw: Any) -> Optional[Dict[str, Any]]:
    """Jeden týždeň kostry. None = bez témy (nepoužiteľný)."""
    if not isinstance(raw, dict):
        return None
    theme = _txt(raw.get("theme"), 120)
    if not theme:
        return None
    load = raw.get("load") if raw.get("load") in LOADS else "moderate"
    return {
        "theme": theme,
        "focus": _txt(raw.get("focus"), 600),
        "load": load,
        "run_sessions": _int(raw.get("run_sessions"), 0, 14),
        "run_minutes": _int(raw.get("run_minutes"), 0, 3000),
        "strength_sessions": _int(raw.get("strength_sessions"), 0, 7),
        "strength_focus": _txt(raw.get("strength_focus"), 300),
        "key_sessions": _str_list(raw.get("key_sessions"), MAX_KEY_SESSIONS, 120),
        # vlastná poznámka usera k týždňu – AI ju nikdy neprepisuje
        "notes": _txt(raw.get("notes"), 600),
    }


def normalize_plan(raw: Any) -> Optional[Dict[str, Any]]:
    """
    Plán z AI alebo z FE (úprava) → uložiteľný tvar. Dátumy týždňov počíta
    BE od pondelka start_date – AI ani FE ich neposielajú.
    """
    if not isinstance(raw, dict):
        return None
    start = _parse_date(raw.get("start_date"))
    if not start:
        return None
    start = monday_of(start)
    weeks = [w for w in (normalize_week(x) for x in (raw.get("weeks") or [])[:MAX_WEEKS]) if w]
    if len(weeks) < MIN_WEEKS:
        return None
    for i, w in enumerate(weeks):
        w["index"] = i + 1
        w["start_date"] = (start + timedelta(days=7 * i)).isoformat()
    title = _txt(raw.get("title"), 120)
    if not title:
        return None
    return {
        "v": 1,
        "title": title,
        "goal_summary": _txt(raw.get("goal_summary"), 800),
        "principles": _str_list(raw.get("principles"), MAX_PRINCIPLES, 200),
        "request": _txt(raw.get("request"), 1500),
        "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=7 * len(weeks) - 1)).isoformat(),
        "weeks": weeks,
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def service_get_season_plan(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    try:
        row = db_get_pref_single(user_id, SEASON_PLAN_KEY, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[SEASON] read failed user={user_id}: {repr(e)}")
        return None
    val = (row or {}).get("value")
    return val if isinstance(val, dict) and val.get("weeks") else None


def service_save_season_plan(user_id: int, raw: Any, *, ctx: AuthCtx) -> Dict[str, Any]:
    plan = normalize_plan(raw)
    if not plan:
        return {"ok": False, "code": "invalid_plan"}
    old = service_get_season_plan(user_id, ctx=ctx) or {}
    plan["created_at"] = old.get("created_at") or _now()
    plan["updated_at"] = _now()
    try:
        db_upsert_pref_single(user_id, SEASON_PLAN_KEY, plan, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[SEASON] save failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "plan": plan}


def service_delete_season_plan(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    try:
        db_delete_pref_single(user_id, SEASON_PLAN_KEY, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[SEASON] delete failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "save_failed"}
    return {"ok": True}


def week_for_date(plan: Dict[str, Any], d: date) -> Optional[Dict[str, Any]]:
    for w in plan.get("weeks") or []:
        start = _parse_date(w.get("start_date"))
        if start and start <= d <= start + timedelta(days=6):
            return w
    return None


def _week_for_ai(w: Optional[Dict[str, Any]], total: int) -> Optional[Dict[str, Any]]:
    if not w:
        return None
    out = {k: v for k, v in w.items() if v not in (None, [], "") and k != "start_date"}
    out["of_weeks"] = total
    if w.get("notes"):
        # PREČO premenované: poznámka je fakt od athleta, nie pokyn pre AI
        out["athlete_note"] = out.pop("notes")
    return out


def season_plan_context_for_ai(
    user_id: int, *, weeks: Dict[str, date], ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """
    Blok pre AI: cieľ obdobia, zásady a týždne kostry pre zadané dni
    (napr. {"reviewed_week": review_start, "plan_week": plan_start}).
    None = plán nie je, skončil pred viac ako týždňom alebo zlyhalo čítanie.
    Chyba nesmie zhodiť hlavnú AI úlohu.
    """
    try:
        plan = service_get_season_plan(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[SEASON] ai context failed user={user_id}: {repr(e)}")
        return None
    if not plan:
        return None
    end = _parse_date(plan.get("end_date"))
    first = min(weeks.values()) if weeks else date.today()
    if end and end < first - timedelta(days=7):
        return None

    total = len(plan.get("weeks") or [])
    out: Dict[str, Any] = {
        "title": plan.get("title"),
        "goal_summary": plan.get("goal_summary"),
        "principles": plan.get("principles") or [],
        "total_weeks": total,
    }
    start = _parse_date(plan.get("start_date"))
    for name, d in weeks.items():
        w = _week_for_ai(week_for_date(plan, d), total)
        if w:
            out[name] = w
        elif start and d < start:
            out[f"{name}_note"] = f"before the plan - it starts in {(start - monday_of(d)).days // 7} week(s)"
        elif end and d > end:
            out[f"{name}_note"] = "after the plan ended"
    return out
