# Services/coach_strength_log.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from DB.coach_plan_daily import (
    db_get_daily_session_by_id_full,
    db_get_strength_log,
    db_save_strength_log,
    db_get_recent_strength_logs,
)

LOG_VERSION = 1
VALID_BLOCKS = {"activation", "strength_main_part", "add_ons", "main_part"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_log() -> Dict[str, Any]:
    return {
        "version": LOG_VERSION,
        "updated_at": _now_iso(),
        "completed": False,
        "session_note": None,
        "exercises": [],
    }


def _seed_from_structure(structure: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Predvyplní log kostrou z naplánovanej AI štruktúry - user tak pri
    otvorení tréningu vidí rovno zoznam cvikov s plánovanými sériami
    a len dopĺňa reálne čísla.
    """
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
                    "rest_s": ex.get("rest_s"),
                },
                "sets": [],
            })
            order += 1
    return out


def service_get_or_init_strength_log(
    *, user_id: int, session_id: int, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Vráti existujúci log, alebo ho inicializuje z naplánovanej štruktúry
    (bez zápisu do DB - zapisuje sa až keď user reálne niečo vyplní).
    """
    existing = db_get_strength_log(user_id, session_id, ctx=ctx)
    if isinstance(existing, dict) and existing.get("exercises"):
        return existing

    session = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not session:
        return _empty_log()

    log = _empty_log()
    log["exercises"] = _seed_from_structure(session.get("structure"))
    return log


def _validate_set(s: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(s, dict):
        return None
    try:
        set_index = int(s.get("set_index") or 0)
    except Exception:
        return None
    if set_index <= 0:
        return None

    def _num(v, lo, hi):
        if v is None or v == "":
            return None
        try:
            f = float(v)
        except Exception:
            return None
        return f if lo <= f <= hi else None

    return {
        "set_index": set_index,
        "weight_kg": _num(s.get("weight_kg"), 0, 1000),
        "reps": int(s["reps"]) if str(s.get("reps") or "").strip().isdigit() else None,
        "rpe": _num(s.get("rpe"), 1, 10),
        "is_warmup": bool(s.get("is_warmup")),
        "done_at": s.get("done_at") or _now_iso(),
    }


def service_save_strength_log(
    *, user_id: int, session_id: int, payload: Dict[str, Any], ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Uloží celý log (last-write-wins). Validuje a normalizuje vstup -
    nikdy neukladáme surový user input priamo do JSONB.
    """
    session = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not session:
        return {"ok": False, "code": "session_not_found"}

    exercises_in = payload.get("exercises")
    if not isinstance(exercises_in, list):
        return {"ok": False, "code": "invalid_payload"}

    exercises_out: List[Dict[str, Any]] = []
    for idx, ex in enumerate(exercises_in):
        if not isinstance(ex, dict):
            continue
        ex_id = ex.get("exercise_id")
        if not ex_id:
            continue

        block = str(ex.get("block") or "strength_main_part")
        if block not in VALID_BLOCKS:
            block = "strength_main_part"

        sets_raw = ex.get("sets")
        sets_out = []
        if isinstance(sets_raw, list):
            for s in sets_raw:
                v = _validate_set(s)
                if v:
                    sets_out.append(v)
        sets_out.sort(key=lambda x: x["set_index"])

        planned = ex.get("planned")
        exercises_out.append({
            "exercise_id": str(ex_id),
            "block": block,
            "order_index": int(ex.get("order_index") or idx),
            "planned": planned if isinstance(planned, dict) else None,
            "sets": sets_out,
        })

    note = payload.get("session_note")
    log = {
        "version": LOG_VERSION,
        "updated_at": _now_iso(),
        "completed": bool(payload.get("completed")),
        "session_note": str(note)[:500] if note else None,
        "exercises": exercises_out,
    }

    ok = db_save_strength_log(user_id, session_id, log, ctx=ctx)
    if not ok:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "data": log}


def service_get_exercise_progression(
    *, user_id: int, exercise_id: str, weeks_back: int = 8, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    História jedného cviku - posledné odcvičené váhy/opakovania.
    Toto pôjde neskôr do AI kontextu aj do progresnej logiky (2-for-2).
    Warmup série sa ignorujú.
    """
    rows = db_get_recent_strength_logs(user_id, weeks_back=weeks_back, ctx=ctx)
    history: List[Dict[str, Any]] = []

    for row in rows:
        log = row.get("strength_log")
        if not isinstance(log, dict):
            continue
        for ex in log.get("exercises") or []:
            if not isinstance(ex, dict) or ex.get("exercise_id") != exercise_id:
                continue
            work_sets = [
                s for s in (ex.get("sets") or [])
                if isinstance(s, dict) and not s.get("is_warmup") and s.get("reps")
            ]
            if not work_sets:
                continue
            top = max(work_sets, key=lambda s: (s.get("weight_kg") or 0))
            history.append({
                "date": str(row.get("plan_date"))[:10],
                "sets_done": len(work_sets),
                "top_weight_kg": top.get("weight_kg"),
                "top_reps": top.get("reps"),
                "avg_rpe": (
                    round(sum(s["rpe"] for s in work_sets if s.get("rpe")) /
                          len([s for s in work_sets if s.get("rpe")]), 1)
                    if any(s.get("rpe") for s in work_sets) else None
                ),
            })

    history.sort(key=lambda h: h["date"], reverse=True)
    return {"exercise_id": exercise_id, "history": history}