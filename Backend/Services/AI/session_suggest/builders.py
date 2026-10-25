# Services/AI/session_suggest/builders.py
"""
Kontext pre AI návrh jedného tréningu (advisor režim, formulár „Pridať tréning“).

ČO SEM PATRÍ: čo athlete robil posledné 2 – 3 dni (aktivity, ručné silové
zápisy, plán), čo ho čaká deň po (plán, preteky, externé aktivity), ako sa
má (recovery, zdravie, únava z athlete state), čo má za vybavenie a čo
napísal. Z toho AI vyberie jeden tréning na zvolený deň.

PREČO tak úzke okno: user rieši „čo si dám dnes“ – rozhoduje, čo bolo
včera a predvčerom a čo je zajtra. Celý týždeň hodnotí advisor review.

Pomocné bloky sa berú z advisor_review (rovnaký tvar aj pravidlá), nič sa
tu nepočíta nanovo.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Configs.strength_catalog import STRENGTH_EXERCISE_CATALOG, get_exercise
from DB.coach_plan_daily import db_get_planned_range_rows
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Modules.Supabase.auth import AuthCtx
from Services.AI.advisor_review.builders import (
    _build_done_activities_block,
    _build_health_block,
    _build_recovery_block,
    _build_state_block,
    _compact_structure,
    _external_event_rows,
    _race_names_by_day,
    _weekday,
)

# Koľko dní pred zvoleným dňom a po ňom AI vidí
DAYS_BACK = 2
DAYS_FORWARD = 1
# Preteky sa hľadajú v širšom okne – taper pred pretekom je dôležitejší
RACE_WINDOW_DAYS = 3

USER_TEXT_MAX = 500


def _clean_text(raw: Any, limit: int = USER_TEXT_MAX) -> Optional[str]:
    s = str(raw or "").strip()
    if not s:
        return None
    return s[:limit]


def _rel_day(d: date, today: date) -> int:
    return (d - today).days


def _day_label(d: date, today: date, lang: str) -> Dict[str, Any]:
    return {"date": d.isoformat(), "weekday": _weekday(d, lang), "days_from_today": _rel_day(d, today)}


def _catalog_for_ai(prefs: Dict[str, Any]) -> List[str]:
    """
    Cviky, ktoré user vie spraviť s vybavením, ktoré má, a ktoré nevadia
    jeho zraneniam. Kompaktne „id|partia|vzor|meranie“ – celý katalóg by
    stál zbytočné tokeny a AI by vyberala aj činku pre usera bez nej.
    """
    from Services.strength.selector import _equipment_ok, _injury_ok

    strength = prefs.get("strength_settings") if isinstance(prefs.get("strength_settings"), dict) else {}
    available = strength.get("available") if isinstance(strength.get("available"), list) else []
    mode = strength.get("equipment_mode") or strength.get("location")
    injuries = set(prefs.get("injuries") or []) if isinstance(prefs.get("injuries"), list) else set()

    out: List[str] = []
    for e in STRENGTH_EXERCISE_CATALOG:
        if not isinstance(e, dict) or not e.get("id"):
            continue
        try:
            if not _equipment_ok(e, available, mode if isinstance(mode, str) else None):
                continue
            if not _injury_ok(e, injuries):
                continue
        except Exception:  # noqa: BLE001
            pass
        out.append(f"{e['id']}|{e.get('target')}|{e.get('pattern')}|{e.get('measure') or 'reps'}")
    return out


def _planned_block(
    user_id: int, *, d_from: date, d_to: date, today: date, lang: str, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """Plán (ručný aj externé aktivity) v okne okolo zvoleného dňa."""
    rows: List[Dict[str, Any]] = []
    try:
        meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
        if meta:
            rows = db_get_planned_range_rows(
                user_id=user_id,
                plan_meta_id=meta.get("id"),
                date_from=d_from.isoformat(),
                date_to=d_to.isoformat(),
                ctx=ctx,
            ) or []
    except Exception as e:  # noqa: BLE001
        print(f"[SUGGEST][builder] plan failed: {repr(e)}")
    rows = rows + _external_event_rows(user_id, date_from=d_from, date_to=d_to, ctx=ctx)

    out: List[Dict[str, Any]] = []
    for r in rows:
        d_str = str(r.get("plan_date") or "")[:10]
        try:
            d_obj = date.fromisoformat(d_str)
        except ValueError:
            continue
        sport = str(r.get("sport") or "other")
        status = r.get("status") or "planned"
        if r.get("activity_id"):
            status = "done"
        item: Dict[str, Any] = {
            **_day_label(d_obj, today, lang),
            "sport": sport,
            "title": r.get("title"),
            "duration_min": r.get("duration_min"),
            "status": status,
            "structure": _compact_structure(sport, r.get("structure")),
        }
        if r.get("is_external"):
            item["is_external"] = True
            if r.get("role"):
                item["role"] = r.get("role")
            if r.get("notes"):
                item["athlete_note"] = r.get("notes")
        out.append(item)
    out.sort(key=lambda x: (x["date"], str(x.get("title") or "")))
    return out


def _strength_logs_block(
    user_id: int, *, d_from: date, d_to: date, today: date, lang: str, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """
    Ručné silové zápisy – PREČO: aktivita zo Stravy povie len „silový
    tréning 50 min“, zápis povie, že to boli nohy. Bez toho by AI dala
    drepy deň po drepoch.
    """
    try:
        from DB.strength_sessions import db_list_strength_sessions_between

        rows = db_list_strength_sessions_between(user_id, d_from.isoformat(), d_to.isoformat(), ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[SUGGEST][builder] strength logs failed: {repr(e)}")
        return []

    out: List[Dict[str, Any]] = []
    for r in rows:
        try:
            d_obj = date.fromisoformat(str(r.get("session_date"))[:10])
        except ValueError:
            continue
        exercises: List[Dict[str, Any]] = []
        for ex in ((r.get("log") or {}).get("exercises") or []):
            if not isinstance(ex, dict):
                continue
            done_sets = [s for s in (ex.get("sets") or []) if isinstance(s, dict) and s.get("reps")]
            if not done_sets:
                continue
            cat = get_exercise(str(ex.get("exercise_id") or "")) or {}
            exercises.append({
                "exercise_id": ex.get("exercise_id"),
                "target": cat.get("target"),
                "sets": len(done_sets),
            })
        if exercises:
            out.append({**_day_label(d_obj, today, lang), "exercises": exercises})
    return out


def _races_block(user_id: int, *, around: date, today: date, lang: str, ctx: AuthCtx) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for d_str, name in (_race_names_by_day(user_id, ctx=ctx) or {}).items():
        try:
            d_obj = date.fromisoformat(d_str)
        except ValueError:
            continue
        if abs((d_obj - around).days) <= RACE_WINDOW_DAYS:
            out.append({**_day_label(d_obj, today, lang), "name": name, "done": d_obj < today})
    out.sort(key=lambda x: x["date"])
    return out


def _zones_block(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    try:
        from DB.user_zones import db_user_zones_fetch_latest

        z = db_user_zones_fetch_latest(user_id=user_id, sport_raw="run", ctx=ctx) or db_user_zones_fetch_latest(
            user_id=user_id, sport_raw=None, ctx=ctx
        )
    except Exception as e:  # noqa: BLE001
        print(f"[SUGGEST][builder] zones failed: {repr(e)}")
        return None
    if not z:
        return None
    return {
        "z1_max": z.get("z1_max_bpm"),
        "z2": [z.get("z2_min_bpm"), z.get("z2_max_bpm")],
        "z3": [z.get("z3_min_bpm"), z.get("z3_max_bpm")],
        "z4": [z.get("z4_min_bpm"), z.get("z4_max_bpm")],
        "hr_max": z.get("hr_max_bpm"),
    }


def _thread_for_ai(thread: Any) -> List[Dict[str, Any]]:
    """
    Predošlé kolá (z FE). Posledný návrh ide celý – AI ho má upraviť,
    nie vymýšľať nový. Staršie návrhy len názvom.
    """
    if not isinstance(thread, list):
        return []
    items = [e for e in thread[-6:] if isinstance(e, dict)]
    last_assistant = max((i for i, e in enumerate(items) if e.get("role") == "assistant"), default=-1)
    out: List[Dict[str, Any]] = []
    for i, e in enumerate(items):
        if e.get("role") == "user":
            txt = _clean_text(e.get("text"))
            if txt:
                out.append({"role": "athlete", "text": txt})
        elif e.get("role") == "assistant":
            sess = e.get("session") if isinstance(e.get("session"), dict) else {}
            entry: Dict[str, Any] = {"role": "coach", "reply_text": _clean_text(e.get("reply_text"), 600)}
            entry["session"] = sess if i == last_assistant else {"title": sess.get("title"), "sport": sess.get("sport")}
            out.append(entry)
    return out


def build_session_suggest_input(
    user_id: int,
    *,
    plan_date: str,
    request: Optional[str],
    thread: Any,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    from Services.user_prefs import service_load_coach_prefs_for_analysis, service_load_user_settings
    from Services.AI.utils.training_focus import load_widget_profile

    try:
        settings = service_load_user_settings(user_id=user_id, ctx=ctx) or {}
    except Exception:  # noqa: BLE001
        settings = {}
    lang = str(settings.get("language") or "sk").lower()[:2]
    lang = lang if lang in ("sk", "cs", "en") else "sk"

    today = date.today()
    try:
        day = date.fromisoformat(str(plan_date)[:10])
    except ValueError:
        day = today

    try:
        prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[SUGGEST][builder] prefs failed: {repr(e)}")
        prefs = {}

    # Odcvičené: od 2 dní pred zvoleným dňom (najviac po dnešok). Pri dni
    # v budúcnosti to doplní plán – jeho dni ešte neprebehli.
    done_from = min(day, today) - timedelta(days=DAYS_BACK)
    done_to = min(day, today)
    done = [
        a for a in _build_done_activities_block(user_id, lang=lang, ctx=ctx)
        if done_from.isoformat() <= str(a.get("date") or "") <= done_to.isoformat()
    ]
    for a in done:
        try:
            a["days_from_today"] = _rel_day(date.fromisoformat(a["date"]), today)
        except (KeyError, ValueError):
            pass

    strength = prefs.get("strength_settings") if isinstance(prefs.get("strength_settings"), dict) else {}

    ctx_out: Dict[str, Any] = {
        "today": _day_label(today, today, lang),
        "target_day": _day_label(day, today, lang),
        "athlete_request": _clean_text(request),
        "conversation": _thread_for_ai(thread),
        "athlete": {
            "main_sport": prefs.get("main_sport"),
            "add_on_sports": prefs.get("add_on_sports"),
            "goal_kind": prefs.get("goal_kind"),
            "training_focus": load_widget_profile(user_id, ctx=ctx),
            "strength_level": strength.get("experience_level"),
            "strength_equipment": strength.get("available"),
            "injuries": prefs.get("injuries"),
        },
        "done_activities": done,
        "strength_logs": _strength_logs_block(
            user_id, d_from=done_from, d_to=done_to, today=today, lang=lang, ctx=ctx
        ),
        "plan_around": _planned_block(
            user_id,
            d_from=day - timedelta(days=DAYS_BACK),
            d_to=day + timedelta(days=DAYS_FORWARD),
            today=today,
            lang=lang,
            ctx=ctx,
        ),
        "races_nearby": _races_block(user_id, around=day, today=today, lang=lang, ctx=ctx),
        "recovery": _build_recovery_block(user_id, ctx=ctx),
        "health_records": _build_health_block(user_id, ctx=ctx),
        "athlete_state": _build_state_block(user_id, ctx=ctx),
        "hr_zones": _zones_block(user_id, ctx=ctx),
        "strength_catalog": _catalog_for_ai(prefs),
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
