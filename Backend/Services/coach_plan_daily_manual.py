# Services/coach_plan_daily_manual.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from Configs.strength_catalog import get_exercise
from DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_get_max_session_index_on_day,
    db_get_daily_session_by_id_full,
    db_update_daily_session_data,
    db_delete_daily_session,
    db_count_sessions_on_day,
    db_get_rest_session_on_day,
)
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Modules.Supabase.auth import AuthCtx

VALID_RUN_LIKE_SPORTS = {"run", "ride", "swim"}
VALID_RUN_SESSION_TYPES = {"easy", "recovery", "long", "tempo", "interval"}
MAX_STRENGTH_EXERCISES = 15
MAX_TITLE_LEN = 200
MAX_NOTES_LEN = 1000
MAX_SESSIONS_PER_DAY = 2  # rovnaký limit ako reschedule (max_per_day=2)


def _build_run_like_structure(
    *,
    mode: str,  # "simple" | "intervals"
    warmup_min: Optional[int],
    warmup_notes: Optional[str],
    cooldown_min: Optional[int],
    cooldown_notes: Optional[str],
    main_minutes: Optional[int],
    main_notes: Optional[str],
    rounds: Optional[int],
    work_min: Optional[int],
    work_notes: Optional[str],
    rest_min: Optional[int],
    rest_notes: Optional[str],
) -> Dict[str, Any]:
    """
    Zostaví structure JSON pre run/ride/swim - rovnaký tvar, aký produkuje
    AI generátor. Warmup/cooldown sú voliteľné.
    """
    structure: Dict[str, Any] = {}

    if warmup_min:
        structure["warmup"] = {"minutes": int(warmup_min), "notes": warmup_notes or ""}
    if cooldown_min:
        structure["cooldown"] = {"minutes": int(cooldown_min), "notes": cooldown_notes or ""}

    if mode == "intervals":
        if not rounds or not work_min:
            raise ValueError("intervals mode requires rounds and work_min")
        structure["main_part"] = [{
            "kind": "interval_block",
            "rounds": int(rounds),
            "work": {"minutes": int(work_min), "notes": work_notes or ""},
            "rest": {"minutes": int(rest_min or 0), "notes": rest_notes or ""},
        }]
    else:
        if not main_minutes:
            raise ValueError("simple mode requires main_minutes")
        structure["main_part"] = [{"minutes": int(main_minutes), "notes": main_notes or ""}]

    return structure


def _build_strength_structure(exercises: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    exercises: [{"exercise_id": str, "sets": int, "reps": str}]
    Validuje exercise_id proti katalógu. Váha sa nezadáva - loguje sa až
    pri reálnom cvičení (strength_sessions.log).
    """
    if not exercises:
        raise ValueError("at least one exercise is required")
    if len(exercises) > MAX_STRENGTH_EXERCISES:
        raise ValueError(f"too many exercises (max {MAX_STRENGTH_EXERCISES})")

    main_part: List[Dict[str, Any]] = []
    for ex in exercises:
        ex_id = str(ex.get("exercise_id") or "")
        if not get_exercise(ex_id):
            raise ValueError(f"unknown exercise_id: {ex_id}")

        sets = ex.get("sets")
        reps = ex.get("reps")
        if not isinstance(sets, int) or sets <= 0 or sets > 20:
            raise ValueError(f"invalid sets for {ex_id}")
        if not reps or not str(reps).strip():
            raise ValueError(f"invalid reps for {ex_id}")

        main_part.append({
            "exercise_id": ex_id,
            "sets": sets,
            "reps": str(reps)[:20],
        })

    return {"strength_main_part": main_part}


def _normalize_sport(sport: Optional[str]) -> str:
    s = str(sport or "other")
    if s in VALID_RUN_LIKE_SPORTS or s == "strength":
        return s
    return "other"


def _resolve_structure(
    *,
    sport_clean: str,
    session_type: Optional[str],
    structure_mode: Optional[str],
    warmup_min: Optional[int],
    warmup_notes: Optional[str],
    cooldown_min: Optional[int],
    cooldown_notes: Optional[str],
    main_minutes: Optional[int],
    main_notes: Optional[str],
    rounds: Optional[int],
    work_min: Optional[int],
    work_notes: Optional[str],
    rest_min: Optional[int],
    rest_notes: Optional[str],
    exercises: Optional[List[Dict[str, Any]]],
) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Spoločné jadro pre create aj update - rozhodne tvar structure podľa
    sport a vráti (structure, session_type).

    session_type: pre run/ride/swim si ho user vyberá (easy/recovery/long/
    tempo/interval). Ak chýba alebo je neplatný, odvodí sa z režimu
    (intervals -> interval, simple -> easy).
    """
    if sport_clean in VALID_RUN_LIKE_SPORTS:
        mode = structure_mode if structure_mode in ("simple", "intervals") else "simple"
        structure = _build_run_like_structure(
            mode=mode,
            warmup_min=warmup_min, warmup_notes=warmup_notes,
            cooldown_min=cooldown_min, cooldown_notes=cooldown_notes,
            main_minutes=main_minutes, main_notes=main_notes,
            rounds=rounds, work_min=work_min, work_notes=work_notes,
            rest_min=rest_min, rest_notes=rest_notes,
        )
        if session_type in VALID_RUN_SESSION_TYPES:
            resolved_type = str(session_type)
        else:
            resolved_type = "interval" if mode == "intervals" else "easy"
        return structure, resolved_type

    if sport_clean == "strength":
        return _build_strength_structure(exercises or []), "other"

    return None, "external_event"


def service_create_manual_daily_session(
    user_id: int,
    *,
    plan_date: str,
    sport: str,
    title: str,
    duration_min: int,
    notes: Optional[str] = None,
    plan_meta_id: Optional[int] = None,
    session_type: Optional[str] = None,
    structure_mode: Optional[str] = None,
    warmup_min: Optional[int] = None,
    warmup_notes: Optional[str] = None,
    cooldown_min: Optional[int] = None,
    cooldown_notes: Optional[str] = None,
    main_minutes: Optional[int] = None,
    main_notes: Optional[str] = None,
    rounds: Optional[int] = None,
    work_min: Optional[int] = None,
    work_notes: Optional[str] = None,
    rest_min: Optional[int] = None,
    rest_notes: Optional[str] = None,
    exercises: Optional[List[Dict[str, Any]]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Ručné pridanie jedného tréningu do denného plánu. coach_mode sa zámerne
    nekontroluje (spontánny futbal dáva zmysel aj v coach režime).

    🌟 NOVÉ: limit MAX_SESSIONS_PER_DAY rovnako ako pri reschedule. Ak na
    dni existuje "rest" riadok (duration 0/NULL), nepočíta sa a pri
    pridaní reálneho tréningu sa zmaže.
    """
    plan_date = str(plan_date)[:10]
    if not plan_date or len(plan_date) != 10:
        return {"ok": False, "code": "invalid_plan_date"}

    title = (title or "").strip()[:MAX_TITLE_LEN]
    if not title:
        return {"ok": False, "code": "title_required"}

    if not isinstance(duration_min, int) or duration_min <= 0 or duration_min > 600:
        return {"ok": False, "code": "invalid_duration"}

    notes_clean = (notes or "").strip()[:MAX_NOTES_LEN] or None

    if plan_meta_id is None:
        meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
        plan_meta_id = meta.get("id") if meta else None

    if plan_meta_id is None:
        return {"ok": False, "code": "no_active_plan"}

    sport_clean = _normalize_sport(sport)

    try:
        structure, resolved_type = _resolve_structure(
            sport_clean=sport_clean,
            session_type=session_type,
            structure_mode=structure_mode,
            warmup_min=warmup_min, warmup_notes=warmup_notes,
            cooldown_min=cooldown_min, cooldown_notes=cooldown_notes,
            main_minutes=main_minutes, main_notes=main_notes,
            rounds=rounds, work_min=work_min, work_notes=work_notes,
            rest_min=rest_min, rest_notes=rest_notes,
            exercises=exercises,
        )
    except ValueError as e:
        return {"ok": False, "code": "invalid_structure", "message": str(e)}

    # 🌟 NOVÉ: kapacita dňa
    rest_row = db_get_rest_session_on_day(
        user_id=user_id, plan_meta_id=plan_meta_id, plan_date=plan_date, ctx=ctx
    )
    cnt = db_count_sessions_on_day(
        user_id=user_id, plan_meta_id=plan_meta_id, plan_date=plan_date, ctx=ctx
    )
    if rest_row:
        cnt -= 1
    if cnt >= MAX_SESSIONS_PER_DAY:
        return {"ok": False, "code": "day_full"}

    if rest_row and rest_row.get("id") is not None:
        db_delete_daily_session(user_id=user_id, session_id=int(rest_row["id"]), ctx=ctx)

    session_index = db_get_max_session_index_on_day(
        user_id=user_id, plan_meta_id=plan_meta_id, plan_date=plan_date, ctx=ctx
    ) + 1

    row = {
        "user_id": user_id,
        "plan_meta_id": plan_meta_id,
        "plan_date": plan_date,
        "sport": sport_clean,
        "title": title,
        "duration_min": duration_min,
        "intensity": None,
        "structure": structure,
        "notes": notes_clean,
        "source": "manual",
        "plan_id": None,
        "session_type": resolved_type,
        "session_index": session_index,
        "payload": None,
        "activity_id": None,
        "status": "planned",
        "preview_thread": None,
        "strength_log": None,
    }

    inserted = db_insert_daily_rows([row], ctx=ctx)
    if not inserted:
        return {"ok": False, "code": "insert_failed"}

    return {"ok": True, "data": inserted[0]}


def service_update_manual_daily_session(
    user_id: int,
    session_id: int,
    *,
    title: Optional[str] = None,
    duration_min: Optional[int] = None,
    notes: Optional[str] = None,
    sport: Optional[str] = None,
    session_type: Optional[str] = None,
    structure_mode: Optional[str] = None,
    warmup_min: Optional[int] = None,
    warmup_notes: Optional[str] = None,
    cooldown_min: Optional[int] = None,
    cooldown_notes: Optional[str] = None,
    main_minutes: Optional[int] = None,
    main_notes: Optional[str] = None,
    rounds: Optional[int] = None,
    work_min: Optional[int] = None,
    work_notes: Optional[str] = None,
    rest_min: Optional[int] = None,
    rest_notes: Optional[str] = None,
    exercises: Optional[List[Dict[str, Any]]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Úprava existujúceho tréningu. Ak je zadané sport, structure aj
    session_type sa prepočítajú celé nanovo cez _resolve_structure.
    """
    existing = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not existing:
        return {"ok": False, "code": "session_not_found"}

    update_data: Dict[str, Any] = {}

    if title is not None:
        title_clean = title.strip()[:MAX_TITLE_LEN]
        if not title_clean:
            return {"ok": False, "code": "title_required"}
        update_data["title"] = title_clean

    if duration_min is not None:
        if not isinstance(duration_min, int) or duration_min <= 0 or duration_min > 600:
            return {"ok": False, "code": "invalid_duration"}
        update_data["duration_min"] = duration_min

    if notes is not None:
        update_data["notes"] = notes.strip()[:MAX_NOTES_LEN] or None

    if sport is not None:
        sport_clean = _normalize_sport(sport)
        try:
            structure, resolved_type = _resolve_structure(
                sport_clean=sport_clean,
                session_type=session_type,
                structure_mode=structure_mode,
                warmup_min=warmup_min, warmup_notes=warmup_notes,
                cooldown_min=cooldown_min, cooldown_notes=cooldown_notes,
                main_minutes=main_minutes, main_notes=main_notes,
                rounds=rounds, work_min=work_min, work_notes=work_notes,
                rest_min=rest_min, rest_notes=rest_notes,
                exercises=exercises,
            )
        except ValueError as e:
            return {"ok": False, "code": "invalid_structure", "message": str(e)}

        update_data["sport"] = sport_clean
        update_data["structure"] = structure
        update_data["session_type"] = resolved_type

    if not update_data:
        return {"ok": True, "data": existing, "note": "no_changes"}

    updated = db_update_daily_session_data(
        user_id=user_id, session_id=session_id, update_data=update_data, ctx=ctx
    )
    if not updated:
        return {"ok": False, "code": "update_failed"}

    return {"ok": True, "data": updated}


def service_delete_manual_daily_session(
    user_id: int,
    session_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Zmazanie jedného tréningu. Nekontroluje source='manual' zámerne - user
    musí vedieť zmazať aj AI riadok, ktorý mu ostal po prepnutí režimu.
    """
    existing = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not existing:
        return {"ok": False, "code": "session_not_found"}

    deleted = db_delete_daily_session(user_id=user_id, session_id=session_id, ctx=ctx)
    if not deleted:
        return {"ok": False, "code": "delete_failed"}

    return {"ok": True, "data": {"id": session_id}}