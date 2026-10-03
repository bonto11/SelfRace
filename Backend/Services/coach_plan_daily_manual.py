# Services/coach_plan_daily_manual.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from Configs.activity_load import (
    build_event_structure,
    default_counts_as_training,
    normalize_activity_load,
    normalize_event_kind,
)
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
MAX_PART_NOTES_LEN = 300
MAX_SESSIONS_PER_DAY = 2  # rovnaký limit ako reschedule (max_per_day=2)

# 🌟 ZMENA: sport="other" už nie je "iný šport" ako tréning, ale INÁ
# AKTIVITA / UDALOSŤ - svadba, teambuilding, sťahovanie, prechádzka, futbal
# mimo plánu. Má vlastný druh a náročnosť (Configs/activity_load.py), takže
# AI poradca vie, čo athléta reálne unaví, aj keď to nie je tréning.
# Udalosť s counts_as_training=False sa nepočíta do tréningového objemu.


# ============================================================
# STRUCTURE BUILDERS
# ============================================================

def _int_or_none(v: Any) -> Optional[int]:
    try:
        if v is None or v == "":
            return None
        return int(round(float(v)))
    except (TypeError, ValueError):
        return None


def _interval_part(
    *,
    unit: Optional[str],
    duration_s: Any,
    distance_m: Any,
    legacy_minutes: Any,
    notes: Optional[str],
    required: bool,
    label: str,
) -> Dict[str, Any]:
    """
    Jedna časť intervalu (úsek alebo pauza) - na čas alebo na vzdialenosť.

    - čas: {"duration_s": 90, "minutes": 1.5, "notes": ...}. "minutes" sa
      ukladá navyše, aby staré čítanie štruktúry (AI prompty, render,
      plan-match) fungovalo bez zmeny.
    - vzdialenosť: {"distance_m": 400, "notes": ...}

    legacy_minutes: spätná kompatibilita pre staré volania s work_min/rest_min.
    """
    notes_clean = (notes or "")[:MAX_PART_NOTES_LEN]

    if unit == "distance":
        dist = _int_or_none(distance_m)
        if dist and dist > 0:
            return {"distance_m": dist, "notes": notes_clean}
        if required:
            raise ValueError(f"{label} requires distance_m")
        return {"duration_s": 0, "minutes": 0, "notes": notes_clean}

    sec = _int_or_none(duration_s)
    if sec is None and legacy_minutes not in (None, ""):
        try:
            sec = int(round(float(legacy_minutes) * 60))
        except (TypeError, ValueError):
            sec = None

    if not sec or sec <= 0:
        if required:
            raise ValueError(f"{label} requires duration_s")
        return {"duration_s": 0, "minutes": 0, "notes": notes_clean}

    return {"duration_s": sec, "minutes": round(sec / 60, 2), "notes": notes_clean}


def _build_run_like_structure(inp: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Zostaví structure pre run/ride/swim. Rovnaký tvar ako AI generátor,
    rozšírený o duration_s / distance_m v intervaloch. Vráti (structure, mode).
    """
    mode = (
        inp.get("structure_mode")
        if inp.get("structure_mode") in ("simple", "intervals")
        else "simple"
    )
    structure: Dict[str, Any] = {}

    warmup_min = _int_or_none(inp.get("warmup_min"))
    cooldown_min = _int_or_none(inp.get("cooldown_min"))
    if warmup_min:
        structure["warmup"] = {
            "minutes": warmup_min,
            "notes": (inp.get("warmup_notes") or "")[:MAX_PART_NOTES_LEN],
        }
    if cooldown_min:
        structure["cooldown"] = {
            "minutes": cooldown_min,
            "notes": (inp.get("cooldown_notes") or "")[:MAX_PART_NOTES_LEN],
        }

    if mode == "intervals":
        rounds = _int_or_none(inp.get("rounds"))
        if not rounds or rounds <= 0:
            raise ValueError("intervals mode requires rounds")

        work = _interval_part(
            unit=inp.get("work_unit"),
            duration_s=inp.get("work_duration_s"),
            distance_m=inp.get("work_distance_m"),
            legacy_minutes=inp.get("work_min"),
            notes=inp.get("work_notes"),
            required=True,
            label="work",
        )
        rest = _interval_part(
            unit=inp.get("rest_unit"),
            duration_s=inp.get("rest_duration_s"),
            distance_m=inp.get("rest_distance_m"),
            legacy_minutes=inp.get("rest_min"),
            notes=inp.get("rest_notes"),
            required=False,
            label="rest",
        )
        structure["main_part"] = [{
            "kind": "interval_block",
            "rounds": rounds,
            "work": work,
            "rest": rest,
        }]
    else:
        main_minutes = _int_or_none(inp.get("main_minutes"))
        if not main_minutes:
            raise ValueError("simple mode requires main_minutes")
        structure["main_part"] = [{
            "minutes": main_minutes,
            "notes": (inp.get("main_notes") or "")[:MAX_PART_NOTES_LEN],
        }]

    return structure, mode


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

        sets = _int_or_none(ex.get("sets"))
        reps = ex.get("reps")
        if not sets or sets <= 0 or sets > 20:
            raise ValueError(f"invalid sets for {ex_id}")
        if not reps or not str(reps).strip():
            raise ValueError(f"invalid reps for {ex_id}")

        main_part.append({
            "exercise_id": ex_id,
            "sets": sets,
            "reps": str(reps).strip()[:20],
        })

    return {"strength_main_part": main_part}


def _build_other_event_structure(inp: Dict[str, Any]) -> Dict[str, Any]:
    """
    🌟 NOVÉ: štruktúra pre inú aktivitu alebo udalosť.

    event_kind:          sport / work / social / chore / travel / other
    event_load:          easy / moderate / hard
    counts_as_training:  má sa rátať do tréningového objemu? Default podľa
                         druhu - šport áno, svadba nie.

    Žiadne main_part - toto nie je tréning a UI to nemá vykresľovať ako
    tréningovú štruktúru.
    """
    kind = normalize_event_kind(inp.get("event_kind"))
    load = normalize_activity_load(inp.get("event_load"))

    raw_counts = inp.get("counts_as_training")
    counts = (
        default_counts_as_training(kind) if raw_counts is None else bool(raw_counts)
    )

    return build_event_structure(
        kind=kind,
        load=load,
        counts_as_training=counts,
        description=inp.get("event_description"),
    )


def _normalize_sport(sport: Optional[str]) -> str:
    s = str(sport or "other")
    if s in VALID_RUN_LIKE_SPORTS or s == "strength":
        return s
    return "other"


def _resolve_structure(
    *, sport_clean: str, inp: Dict[str, Any]
) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Spoločné jadro pre create aj update - vráti (structure, session_type).

    inp obsahuje všetky voliteľné štruktúrne polia (session_type,
    structure_mode, warmup/cooldown, main, intervaly, exercises, event_*).
    Pridanie ďalšieho poľa = len zmena tu a v route modeli, nie v 3
    signatúrach.
    """
    if sport_clean in VALID_RUN_LIKE_SPORTS:
        structure, mode = _build_run_like_structure(inp)
        session_type = inp.get("session_type")
        if session_type in VALID_RUN_SESSION_TYPES:
            resolved_type = str(session_type)
        else:
            resolved_type = "interval" if mode == "intervals" else "easy"
        return structure, resolved_type

    if sport_clean == "strength":
        return _build_strength_structure(inp.get("exercises") or []), "other"

    # other = iná aktivita / udalosť
    return _build_other_event_structure(inp), "external_event"


# ============================================================
# CREATE / UPDATE / DELETE
# ============================================================

def service_create_manual_daily_session(
    user_id: int,
    *,
    plan_date: str,
    sport: str,
    title: str,
    duration_min: int,
    notes: Optional[str] = None,
    plan_meta_id: Optional[int] = None,
    structure_input: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Ručné pridanie jedného tréningu alebo udalosti do denného plánu.
    coach_mode sa zámerne nekontroluje (spontánny futbal aj svadba dávajú
    zmysel v oboch režimoch).

    Limit MAX_SESSIONS_PER_DAY rovnako ako pri reschedule; "rest" riadok
    (duration 0/NULL) sa nepočíta a pri pridaní reálneho tréningu sa zmaže.
    """
    plan_date = str(plan_date)[:10]
    if not plan_date or len(plan_date) != 10:
        return {"ok": False, "code": "invalid_plan_date"}

    title = (title or "").strip()[:MAX_TITLE_LEN]
    if not title:
        return {"ok": False, "code": "title_required"}

    # Udalosť môže trvať celý deň (svadba), tréning nie.
    sport_clean = _normalize_sport(sport)
    max_duration = 1440 if sport_clean == "other" else 600
    if not isinstance(duration_min, int) or duration_min <= 0 or duration_min > max_duration:
        return {"ok": False, "code": "invalid_duration"}

    notes_clean = (notes or "").strip()[:MAX_NOTES_LEN] or None

    if plan_meta_id is None:
        meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
        plan_meta_id = meta.get("id") if meta else None

    if plan_meta_id is None:
        return {"ok": False, "code": "no_active_plan"}

    try:
        structure, resolved_type = _resolve_structure(
            sport_clean=sport_clean, inp=structure_input or {}
        )
    except ValueError as e:
        return {"ok": False, "code": "invalid_structure", "message": str(e)}

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
    structure_input: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Úprava existujúceho tréningu alebo udalosti. Ak je zadané sport,
    structure aj session_type sa prepočítajú celé nanovo zo structure_input.
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
        # Strop podľa toho, čo riadok po úprave bude - sport z requestu, ak
        # prišiel, inak pôvodný.
        effective_sport = _normalize_sport(sport or existing.get("sport"))
        max_duration = 1440 if effective_sport == "other" else 600
        if (
            not isinstance(duration_min, int)
            or duration_min <= 0
            or duration_min > max_duration
        ):
            return {"ok": False, "code": "invalid_duration"}
        update_data["duration_min"] = duration_min

    if notes is not None:
        update_data["notes"] = notes.strip()[:MAX_NOTES_LEN] or None

    if sport is not None:
        sport_clean = _normalize_sport(sport)
        try:
            structure, resolved_type = _resolve_structure(
                sport_clean=sport_clean, inp=structure_input or {}
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
    Zmazanie jedného tréningu alebo udalosti. Nekontroluje source='manual'
    zámerne - user musí vedieť zmazať aj AI riadok, ktorý mu ostal po
    prepnutí režimu.
    """
    existing = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not existing:
        return {"ok": False, "code": "session_not_found"}

    deleted = db_delete_daily_session(user_id=user_id, session_id=session_id, ctx=ctx)
    if not deleted:
        return {"ok": False, "code": "delete_failed"}

    return {"ok": True, "data": {"id": session_id}}
