# Services/strength_sessions.py
from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import re
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

from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Configs.strength_muscles import MUSCLE_GROUPS, get_muscles
from Configs.strength_volume import build_targets, compare_to_target, run_volume_tier, volume_bands_public
from DB.coach_plan_daily import db_get_daily_session_by_id_full,  db_get_daily_session_by_id_full, db_get_planned_range_rows
from DB.user_prefs import db_get_pref_single
from Services.analytics_RecentLoad import service_build_recent_load_raw

LOG_VERSION = 1
VALID_BLOCKS = {"activation", "strength_main_part", "add_ons"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_log() -> Dict[str, Any]:
    return {"version": LOG_VERSION, "exercises": []}

def _parse_sets(v: Any) -> int:
    """Počet sérií z plánu: 3, "3" alebo "3-4" (vezme prvé číslo)."""
    if isinstance(v, (int, float)):
        return max(0, int(v))
    m = re.search(r"\d+", str(v or ""))
    return int(m.group()) if m else 0


def _planned_muscle_sets(
    user_id: int,
    *,
    week_start: date,
    today: date,
    logged_dates: set,
    logged_plan_ids: set,
    ctx: AuthCtx,
) -> Dict[str, float]:
    """
    🌟 NOVÉ: série z NAPLÁNOVANÝCH silových tréningov od dnes po nedeľu.

    Preskakuje sa:
    - tréning, ktorý už má zapísané pracovné série (cez plan_session_id),
    - deň, v ktorom už nejaký zápis existuje (aby sa nepočítalo dvakrát),
    - hotové tréningy (status != planned, alebo viazané na aktivitu).
    Minulé neodcvičené plány sa ignorujú.
    """
    out: Dict[str, float] = {}

    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or meta.get("id") is None:
        return out

    week_end = week_start + timedelta(days=6)
    rows = db_get_planned_range_rows(
        user_id=user_id,
        plan_meta_id=meta.get("id"),
        date_from=max(today, week_start).isoformat(),
        date_to=week_end.isoformat(),
        ctx=ctx,
    ) or []

    for r in rows:
        if str(r.get("sport") or "") != "strength":
            continue
        if (r.get("status") or "planned") != "planned" or r.get("activity_id"):
            continue

        rid = r.get("id")
        if rid is not None and int(rid) in logged_plan_ids:
            continue
        if str(r.get("plan_date") or "")[:10] in logged_dates:
            continue

        structure = r.get("structure") or (r.get("payload") or {}).get("structure")
        if structure is None and rid is not None:
            full = db_get_daily_session_by_id_full(user_id, int(rid), ctx=ctx) or {}
            structure = full.get("structure")
        if not isinstance(structure, dict):
            continue

        for block in ("activation", "strength_main_part", "add_ons"):
            for ex in structure.get(block) or []:
                if not isinstance(ex, dict):
                    continue
                n_sets = _parse_sets(ex.get("sets"))
                if n_sets <= 0:
                    continue
                for muscle, weight in get_muscles(str(ex.get("exercise_id") or "")).items():
                    out[muscle] = out.get(muscle, 0.0) + n_sets * float(weight)

    return out


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

def _resolve_volume_context(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    🌟 NOVÉ: cieľ objemu a behový objem si service zistí sám - FE nemá dôvod
    posielať niečo, čo je uložené v prefs.

    weekly_run_minutes: priemer posledných troch ukončených týždňov z
    recent_load. Jeden vynechaný týždeň tak nespôsobí, že sa cieľ pre nohy
    hneď vystrelí hore.
    """
    goal = "maintain"
    sessions_per_week: Optional[int] = None

    try:
        pref_row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
        prefs_val = (pref_row.get("value") or {}) if pref_row else {}
        settings = prefs_val.get("strength_settings") or {}
        if settings.get("volume_goal") in ("maintain", "develop"):
            goal = settings["volume_goal"]
        spw = settings.get("sessions_per_week")
        if spw is not None:
            sessions_per_week = int(spw)
    except Exception as e:  # noqa: BLE001
        print(f"[STRENGTH-VOLUME] prefs read failed user={user_id}: {repr(e)}")

    weekly_run_minutes: Optional[float] = None
    try:
        rl = service_build_recent_load_raw(user_id=user_id, window_days=28, ctx=ctx)
        weeks = [
            w for w in (rl.get("weeks") or [])
            if isinstance(w, dict) and int(w.get("week_index_from_now", 0)) < 0
        ]
        if weeks:
            recent = sorted(weeks, key=lambda w: int(w.get("week_index_from_now") or 0))[-3:]
            weekly_run_minutes = sum(
                float(w.get("total_minutes") or 0.0) for w in recent
            ) / len(recent)
    except Exception as e:  # noqa: BLE001
        print(f"[STRENGTH-VOLUME] recent load failed user={user_id}: {repr(e)}")

    return {
        "goal": goal,
        "sessions_per_week": sessions_per_week,
        "weekly_run_minutes": weekly_run_minutes,
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


def service_get_weekly_muscle_volume(
    *,
    user_id: int,
    weeks_back: int = 4,
    goal: str = "maintain",
    sessions_per_week: Optional[int] = None,
    weekly_run_minutes: Optional[float] = None,
    exclude_session_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Týždenný objem na svalovú partiu = ZAPÍSANÉ + NAPLÁNOVANÉ.

    Ráta len pracovné série (warmup nie), zlomkovo podľa strength_muscles.py.
    Stav (under/on_track/over) sa hodnotí voči PREDPOVEDI (zapísané +
    naplánované), aby user videl, kam ho tento týždeň dovedie plán.
    """
    rows = db_list_strength_sessions(user_id, weeks_back=weeks_back, limit=200, ctx=ctx)

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    window_start = week_start - timedelta(weeks=max(0, weeks_back - 1))

    current: Dict[str, float] = {m: 0.0 for m in MUSCLE_GROUPS}
    window: Dict[str, float] = {m: 0.0 for m in MUSCLE_GROUPS}
    weeks_seen: set = set()
    logged_dates: set = set()
    logged_plan_ids: set = set()

    for row in rows:
        if exclude_session_id is not None and row.get("id") == exclude_session_id:
            continue
        d_raw = str(row.get("session_date") or "")[:10]
        try:
            d = date.fromisoformat(d_raw)
        except ValueError:
            continue
        if d < window_start:
            continue

        w_start = d - timedelta(days=d.weekday())
        is_current = w_start == week_start
        # zápisy s budúcim dátumom v aktuálnom týždni sú platné, staršie
        # týždne len do dneška
        if d > today and not is_current:
            continue

        log = row.get("log")
        if not isinstance(log, dict):
            continue

        row_has_sets = False
        for ex in (log.get("exercises") or []):
            if not isinstance(ex, dict):
                continue
            work_sets = [
                s for s in (ex.get("sets") or [])
                if isinstance(s, dict)
                and not s.get("is_warmup")
                and (s.get("reps") or s.get("weight_kg"))
            ]
            if not work_sets:
                continue
            row_has_sets = True

            for muscle, weight in get_muscles(str(ex.get("exercise_id") or "")).items():
                contribution = len(work_sets) * float(weight)
                window[muscle] = window.get(muscle, 0.0) + contribution
                if is_current:
                    current[muscle] = current.get(muscle, 0.0) + contribution

        if row_has_sets:
            weeks_seen.add(w_start.isoformat())
            if is_current:
                logged_dates.add(d.isoformat())
                if row.get("plan_session_id") is not None:
                    logged_plan_ids.add(int(row["plan_session_id"]))

    planned = _planned_muscle_sets(
        user_id,
        week_start=week_start,
        today=today,
        logged_dates=logged_dates,
        logged_plan_ids=logged_plan_ids,
        ctx=ctx,
    )

    week_count = max(1, len(weeks_seen))
    targets = build_targets(
        MUSCLE_GROUPS,
        goal=goal if goal in ("maintain", "develop") else "maintain",
        weekly_run_minutes=weekly_run_minutes,
        sessions_per_week=sessions_per_week,
    )

    muscles_out: List[Dict[str, Any]] = []
    for m in MUSCLE_GROUPS:
        done = current.get(m, 0.0)
        plan = planned.get(m, 0.0)
        projected = done + plan
        target = targets[m]
        cmp_proj = compare_to_target(projected, target)
        muscles_out.append({
            "muscle": m,
            "sets_this_week": round(done, 1),
            "sets_planned": round(plan, 1),
            "sets_projected": round(projected, 1),
            "sets_avg_per_week": round(window.get(m, 0.0) / week_count, 1),
            "target": target,
            "pct_done": round(done / target * 100) if target > 0 else 0,
            "pct": cmp_proj["pct"],
            "status": cmp_proj["status"],
        })

    bands = volume_bands_public()
    scale_max = max(
        bands["overreach"],
        max((x["target"] for x in muscles_out), default=0),
        max((x["sets_projected"] for x in muscles_out), default=0),
    )

    return {
        "week_start": week_start.isoformat(),
        "goal": goal,
        "run_volume_tier": run_volume_tier(weekly_run_minutes),
        "weeks_analyzed": week_count,
        "muscles": muscles_out,
        "total_sets_this_week": round(sum(x["sets_this_week"] for x in muscles_out), 1),
        "total_sets_planned": round(sum(x["sets_planned"] for x in muscles_out), 1),
        "bands": bands,
        "scale_max": int(round(scale_max)),
    }

def service_get_muscle_volume_overview(
    *,
    user_id: int,
    weeks_back: int = 4,
    exclude_session_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Objem na partie s cieľmi odvodenými z prefs a reálneho behového objemu.

    exclude_session_id: práve editovaný zápis sa zo základu vynechá - inak
    by sa v živom náhľade počítal dvakrát (raz zo základu, raz z draftu).
    """
    vc = _resolve_volume_context(user_id, ctx=ctx)
    return service_get_weekly_muscle_volume(
        user_id=user_id,
        weeks_back=weeks_back,
        goal=vc["goal"],
        sessions_per_week=vc["sessions_per_week"],
        weekly_run_minutes=vc["weekly_run_minutes"],
        exclude_session_id=exclude_session_id,
        ctx=ctx,
    )
