# Services/strength_sessions.py
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from DB.strength_sessions import (
    db_insert_strength_session,
    db_get_strength_session,
    db_get_strength_session_by_plan,
    db_get_strength_session_by_activity,
    db_list_strength_sessions,
    db_update_strength_session,
    db_delete_strength_session,
    db_find_unmatched_strength_sessions_for_date,
    db_list_planned_strength_sessions,
)
from DB.coach_plan_daily import db_get_daily_session_by_id_full

LOG_VERSION = 1
VALID_BLOCKS = {"activation", "strength_main_part", "add_ons"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_log() -> Dict[str, Any]:
    return {"version": LOG_VERSION, "exercises": []}


def _seed_exercises_from_plan_structure(structure: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Predvyplní cviky z naplánovanej AI štruktúry (plán -> log kostra)."""
    out: List[Dict[str, Any]] = []
    if not isinstance(structure, dict):
        return out

    order = 0
    for block in ("activation", "strength_main_part", "add_ons"):
        items = structure.get(block)
        if not isinstance(items, list):
            continue
        for ex in items:
            if not isinstance(ex, dict):
                continue
            ex_id = ex.get("exercise_id")
            if not ex_id:
                continue
            out.append({
                "exercise_id": str(ex_id),
                "block": block,
                "order_index": order,
                "planned": {
                    "sets": ex.get("sets"),
                    "reps": ex.get("reps"),
                    "rest_s": ex.get("rest_s") or ex.get("rest_sec"),
                },
                "sets": [],
            })
            order += 1
    return out


def _num(v: Any, lo: float, hi: float) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except Exception:
        return None
    return f if lo <= f <= hi else None


def _validate_set(s: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(s, dict):
        return None
    try:
        set_index = int(s.get("set_index") or 0)
    except Exception:
        return None
    if set_index <= 0:
        return None

    reps_raw = s.get("reps")
    reps: Optional[int] = None
    if reps_raw not in (None, ""):
        try:
            r = int(reps_raw)
            reps = r if 0 <= r <= 500 else None
        except Exception:
            reps = None

    return {
        "set_index": set_index,
        "weight_kg": _num(s.get("weight_kg"), 0, 1000),
        "reps": reps,
        "rpe": _num(s.get("rpe"), 1, 10),
        "is_warmup": bool(s.get("is_warmup")),
        "done_at": s.get("done_at") or _now_iso(),
    }


def _normalize_exercises(raw: Any) -> List[Dict[str, Any]]:
    """Nikdy neukladáme surový user input priamo do JSONB."""
    out: List[Dict[str, Any]] = []
    if not isinstance(raw, list):
        return out

    for idx, ex in enumerate(raw):
        if not isinstance(ex, dict):
            continue
        ex_id = ex.get("exercise_id")
        if not ex_id:
            continue

        block = str(ex.get("block") or "strength_main_part")
        if block not in VALID_BLOCKS:
            block = "strength_main_part"

        sets_out: List[Dict[str, Any]] = []
        for s in (ex.get("sets") or []):
            v = _validate_set(s)
            if v:
                sets_out.append(v)
        sets_out.sort(key=lambda x: x["set_index"])

        planned = ex.get("planned")
        out.append({
            "exercise_id": str(ex_id)[:100],
            "block": block,
            "order_index": int(ex.get("order_index") or idx),
            "planned": planned if isinstance(planned, dict) else None,
            "sets": sets_out,
        })

    out.sort(key=lambda x: x["order_index"])
    return out


# ============================================================
# CREATE
# ============================================================

def service_create_strength_session(
    *,
    user_id: int,
    session_date: Optional[str] = None,
    title: Optional[str] = None,
    plan_session_id: Optional[int] = None,
    activity_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vytvorí nový záznam silového tréningu.

    - plan_session_id: predvyplní cviky z naplánovanej session. Ak už pre
      ten plán existuje log, vráti ten existujúci (idempotentné - user
      neklikne omylom dvakrát a nevytvorí duplicitu).
    - session_date: default dnes, user ho môže zmeniť.
    """
    if plan_session_id:
        existing = db_get_strength_session_by_plan(user_id, int(plan_session_id), ctx=ctx)
        if existing:
            return {"ok": True, "data": existing, "note": "existing"}

    if activity_id:
        existing = db_get_strength_session_by_activity(user_id, int(activity_id), ctx=ctx)
        if existing:
            return {"ok": True, "data": existing, "note": "existing"}

    log = _empty_log()
    resolved_title = title
    resolved_date = (session_date or date.today().isoformat())[:10]

    if plan_session_id:
        plan = db_get_daily_session_by_id_full(user_id, int(plan_session_id), ctx=ctx)
        if plan:
            log["exercises"] = _seed_exercises_from_plan_structure(plan.get("structure"))
            resolved_title = resolved_title or plan.get("title")
            if not session_date and plan.get("plan_date"):
                resolved_date = str(plan["plan_date"])[:10]

    row = {
        "user_id": int(user_id),
        "session_date": resolved_date,
        "plan_session_id": int(plan_session_id) if plan_session_id else None,
        "activity_id": int(activity_id) if activity_id else None,
        "title": resolved_title,
        "log": log,
        "completed": False,
        "session_note": None,
    }

    created = db_insert_strength_session(row, ctx=ctx)
    if not created:
        return {"ok": False, "code": "insert_failed"}
    return {"ok": True, "data": created, "note": "created"}


# ============================================================
# READ
# ============================================================

def service_get_strength_session(
    *, user_id: int, session_id: int, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    return db_get_strength_session(user_id, session_id, ctx=ctx)


def service_get_by_plan_session(
    *, user_id: int, plan_session_id: int, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    return db_get_strength_session_by_plan(user_id, plan_session_id, ctx=ctx)


def service_get_by_activity(
    *, user_id: int, activity_id: int, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """
    🌟 NOVÉ: zápis silového tréningu naviazaný na Strava aktivitu.

    Väzbu vytvára service_match_strength_session_to_activity pri importe
    aktivity. DB vrstva to vedela (db_get_strength_session_by_activity), ale
    service ani route to nesprístupňovali - detail aktivity si preto nevedel
    natiahnuť, čo sa v tej aktivite reálne odcvičilo.
    """
    if not user_id or not activity_id:
        return None
    return db_get_strength_session_by_activity(user_id, int(activity_id), ctx=ctx)


def service_list_strength_sessions(
    *, user_id: int, weeks_back: int = 12, limit: int = 100, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    return db_list_strength_sessions(user_id, weeks_back=weeks_back, limit=limit, ctx=ctx)


# ============================================================
# UPDATE
# ============================================================

def service_update_strength_session(
    *,
    user_id: int,
    session_id: int,
    exercises: Optional[List[Dict[str, Any]]] = None,
    completed: Optional[bool] = None,
    session_note: Optional[str] = None,
    session_date: Optional[str] = None,
    title: Optional[str] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    existing = db_get_strength_session(user_id, session_id, ctx=ctx)
    if not existing:
        return {"ok": False, "code": "session_not_found"}

    patch: Dict[str, Any] = {}

    if exercises is not None:
        patch["log"] = {
            "version": LOG_VERSION,
            "exercises": _normalize_exercises(exercises),
        }
    if completed is not None:
        patch["completed"] = bool(completed)
    if session_note is not None:
        patch["session_note"] = str(session_note)[:500] or None
    if session_date is not None:
        patch["session_date"] = str(session_date)[:10]
    if title is not None:
        patch["title"] = str(title)[:200] or None

    if not patch:
        return {"ok": True, "data": existing, "note": "no_changes"}

    updated = db_update_strength_session(user_id, session_id, patch, ctx=ctx)
    if not updated:
        return {"ok": False, "code": "update_failed"}
    return {"ok": True, "data": updated}


def service_delete_strength_session(
    *, user_id: int, session_id: int, ctx: AuthCtx
) -> Dict[str, Any]:
    ok = db_delete_strength_session(user_id, session_id, ctx=ctx)
    return {"ok": ok} if ok else {"ok": False, "code": "delete_failed"}


# ============================================================
# MATCHING PRI SYNCU
# ============================================================

def service_match_strength_session_to_activity(
    *,
    user_id: int,
    activity_id: int,
    activity_date: str,
    sport_type_fe: Optional[str],
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Volá sa po importe Strava aktivity. Ak je aktivita silová a existuje
    nespárovaný log z rovnakého dňa, doplní mu activity_id.

    Best-effort - zlyhanie nikdy nesmie zhodiť import aktivity.
    """
    if str(sport_type_fe or "").lower() != "strength":
        return None

    try:
        candidates = db_find_unmatched_strength_sessions_for_date(
            user_id, str(activity_date)[:10], ctx=ctx
        )
        if not candidates:
            return None

        # Najnovšie vytvorený log daného dňa (už zoradené desc)
        target = candidates[0]
        updated = db_update_strength_session(
            user_id, int(target["id"]), {"activity_id": int(activity_id)}, ctx=ctx
        )
        if updated:
            print(
                f"[STRENGTH-MATCH] user={user_id} strength_session={target['id']} "
                f"-> activity={activity_id}"
            )
        return updated
    except Exception as e:  # noqa: BLE001
        print(f"[STRENGTH-MATCH] failed user={user_id} activity={activity_id}: {repr(e)}")
        return None


# ============================================================
# PROGRESIA
# ============================================================

def service_get_exercise_progression(
    *, user_id: int, exercise_id: str, weeks_back: int = 12, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    História jedného cviku - top séria za každý tréning. Warmup série sa
    ignorujú. Toto pôjde neskôr do AI kontextu aj do progresnej logiky.
    """
    rows = db_list_strength_sessions(user_id, weeks_back=weeks_back, limit=200, ctx=ctx)
    history: List[Dict[str, Any]] = []

    for row in rows:
        log = row.get("log")
        if not isinstance(log, dict):
            continue
        for ex in (log.get("exercises") or []):
            if not isinstance(ex, dict) or ex.get("exercise_id") != exercise_id:
                continue
            work_sets = [
                s for s in (ex.get("sets") or [])
                if isinstance(s, dict) and not s.get("is_warmup") and s.get("reps")
            ]
            if not work_sets:
                continue

            top = max(work_sets, key=lambda s: (s.get("weight_kg") or 0))
            rpes = [s["rpe"] for s in work_sets if s.get("rpe")]
            volume = sum(
                (s.get("weight_kg") or 0) * (s.get("reps") or 0) for s in work_sets
            )

            history.append({
                "date": str(row.get("session_date"))[:10],
                "sets_done": len(work_sets),
                "top_weight_kg": top.get("weight_kg"),
                "top_reps": top.get("reps"),
                "volume_kg": round(volume),
                "avg_rpe": round(sum(rpes) / len(rpes), 1) if rpes else None,
            })

    history.sort(key=lambda h: h["date"], reverse=True)
    return {"exercise_id": exercise_id, "history": history}
    
def service_list_planned_strength_sessions(
    *, user_id: int, days_back: int = 14, days_forward: int = 7, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """
    Zoznam naplánovaných silových tréningov na import. Vracia len tie,
    ktoré reálne obsahujú nejaké cviky.
    """
    rows = db_list_planned_strength_sessions(
        user_id, days_back=days_back, days_forward=days_forward, ctx=ctx
    )
    out: List[Dict[str, Any]] = []
    for r in rows:
        exercises = _seed_exercises_from_plan_structure(r.get("structure"))
        if not exercises:
            continue
        out.append({
            "id": r.get("id"),
            "plan_date": str(r.get("plan_date"))[:10],
            "title": r.get("title"),
            "exercise_count": len(exercises),
        })
    return out


def service_import_from_plan(
    *, user_id: int, session_id: int, plan_session_id: int, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Naimportuje kostru cvikov z naplánovanej session do existujúceho
    zápisu. Prepíše doterajšie cviky - user je na to upozornený v UI.
    Zároveň naviaže zápis na plán (plan_session_id) a prevezme názov,
    ak zápis ešte žiadny nemá.
    """
    existing = db_get_strength_session(user_id, session_id, ctx=ctx)
    if not existing:
        return {"ok": False, "code": "session_not_found"}

    plan = db_get_daily_session_by_id_full(user_id, int(plan_session_id), ctx=ctx)
    if not plan:
        return {"ok": False, "code": "plan_session_not_found"}

    exercises = _seed_exercises_from_plan_structure(plan.get("structure"))
    if not exercises:
        return {"ok": False, "code": "plan_has_no_exercises"}

    patch: Dict[str, Any] = {
        "log": {"version": LOG_VERSION, "exercises": exercises},
        "plan_session_id": int(plan_session_id),
    }
    if not existing.get("title") and plan.get("title"):
        patch["title"] = plan["title"]

    updated = db_update_strength_session(user_id, session_id, patch, ctx=ctx)
    if not updated:
        return {"ok": False, "code": "update_failed"}
    return {"ok": True, "data": updated}