# ===== Services/AI/daily_plan.py =====
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from Configs.config import DEFAULT_MODEL, COACH_PLAN_SCAN_HORIZON_DAYS
from Routes_AI.daily_plan_generate import generate_daily_week_json
from Routes_DB.coach_plan_daily import (
    db_clear_daily_for_user_week,
    db_insert_daily_rows,
    db_list_daily_for_user_horizon,
)
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_DB.coach_plan_weekly import db_get_weekly_for_user_plan
from Services.AI.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.AI.daily_plan_builders import (
    build_daily_context_from_db,
    build_daily_rows_from_ai,
)
from Services.coach_strength_mapper import enrich_daily_plan_with_strength_exercises
from Services.users import require_jwt

# -----------------------------------------------------------------------------
# Fixed-slot derivation + minimal server-side enforcement (copy-paste safe)
# -----------------------------------------------------------------------------

WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}

_WEEKDAY_TO_ABBR: Dict[int, str] = {
    0: "Mon",
    1: "Tue",
    2: "Wed",
    3: "Thu",
    4: "Fri",
    5: "Sat",
    6: "Sun",
}


def _weekday_abbr_from_iso(d: Optional[str]) -> Optional[str]:
    if not isinstance(d, str) or not d:
        return None
    try:
        dd = date.fromisoformat(d[:10])
        return _WEEKDAY_TO_ABBR.get(dd.weekday())
    except Exception:
        return None


def _derive_fixed_slots_daily(
    weekly_template: Dict[str, Any],
    max_fixed: int = 7,
) -> List[Dict[str, Any]]:
    """
    Z weekly_template vyberie sloty s priority == "key".

    - ai_can_move == False -> HARD fixed (coach má držať konkrétny deň)
    - ai_can_move == True  -> SOFT preferred
    """
    if not isinstance(weekly_template, dict):
        return []

    days = weekly_template.get("days")
    if not isinstance(days, list):
        return []

    ordered_days: List[Dict[str, Any]] = sorted(
        (d for d in days if isinstance(d, dict) and isinstance(d.get("day"), str)),
        key=lambda d: WEEKDAY_ORDER.get(str(d.get("day") or ""), 99),
    )

    fixed: List[Dict[str, Any]] = []

    for d in ordered_days:
        day_name = d.get("day")
        slots = d.get("slots") or []
        if not isinstance(slots, list):
            continue

        for s in slots:
            if not isinstance(s, dict):
                continue

            priority = s.get("priority")
            if priority != "key":
                continue

            sport = s.get("sport")
            kind = s.get("kind")
            if not (day_name and sport and kind):
                continue

            ai_can_move_val = s.get("ai_can_move")
            hard = (ai_can_move_val is False)

            fixed.append(
                {
                    "weekday": str(day_name),
                    "sport": str(sport),
                    "kind": str(kind),
                    "priority": str(priority),
                    "ai_can_move": bool(ai_can_move_val) if ai_can_move_val is not None else True,
                    "policy": "hard" if hard else "soft",
                }
            )

            if len(fixed) >= max_fixed:
                return fixed

    return fixed


def _ensure_payload_dict(s: Dict[str, Any]) -> Dict[str, Any]:
    p = s.get("payload")
    if isinstance(p, dict):
        return p
    p = {}
    s["payload"] = p
    return p


def _matches_fixed_slot_session(s: Dict[str, Any], fs: Dict[str, Any], weekday: str) -> bool:
    """
    Prefer strict match by payload.fixed_slot. Fallback: match by sport on that weekday.
    """
    if not isinstance(s, dict) or not isinstance(fs, dict):
        return False

    p = s.get("payload")
    if isinstance(p, dict):
        f = p.get("fixed_slot")
        if isinstance(f, dict):
            return (
                str(f.get("weekday")) == weekday
                and str(f.get("sport")) == str(fs.get("sport"))
                and str(f.get("kind")) == str(fs.get("kind"))
            )

    return str(s.get("sport")) == str(fs.get("sport"))


def enforce_hard_fixed_slots(
    daily_plan: Dict[str, Any],
    fixed_slots: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Ensure every HARD fixed slot exists on that weekday.

    Minimal intervention:
    - If session exists that day that matches -> just tag it (payload.fixed_slot).
    - If not -> add ONE placeholder session (coach_override / safe default).
    """
    if not isinstance(daily_plan, dict):
        return daily_plan

    days = daily_plan.get("days")
    if not isinstance(days, list) or not days:
        return daily_plan

    hard_slots = [
        fs for fs in fixed_slots
        if isinstance(fs, dict) and fs.get("policy") == "hard"
    ]
    if not hard_slots:
        return daily_plan

    by_weekday: Dict[str, Dict[str, Any]] = {}
    for day in days:
        if not isinstance(day, dict):
            continue
        wd = _weekday_abbr_from_iso(day.get("date"))
        if wd:
            by_weekday[wd] = day

    for fs in hard_slots:
        weekday = str(fs.get("weekday") or "")
        if not weekday:
            continue

        day = by_weekday.get(weekday)
        if not day:
            continue

        sessions = day.get("sessions")
        if not isinstance(sessions, list):
            sessions = []
            day["sessions"] = sessions

        chosen: Optional[Dict[str, Any]] = None
        for s in sessions:
            if isinstance(s, dict) and _matches_fixed_slot_session(s, fs, weekday):
                chosen = s
                break

        if chosen is not None:
            payload = _ensure_payload_dict(chosen)
            payload.setdefault(
                "fixed_slot",
                {
                    "weekday": weekday,
                    "sport": fs.get("sport"),
                    "kind": fs.get("kind"),
                    "policy": fs.get("policy"),
                },
            )
            continue

        sport = str(fs.get("sport") or "other")
        kind = str(fs.get("kind") or "full")

        if sport == "strength":
            title = "Silový tréning (fixný deň)"
            duration = 75 if kind == "full" else 45
            session_type = "coach_override"
            intensity = "moderate"
            structure = {
                "warmup": {"minutes": 15, "notes": "Aktivácia + mobilita."},
                "strength_exercises": [
                    {"slot": "core", "sets": 2, "reps": "8–12", "rest_s": 45, "notes": "Aktivácia."},
                    {"slot": "lower_posterior", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť."},
                    {"slot": "lower_quad", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť."},
                    {"slot": "upper_pull", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť."},
                    {"slot": "upper_push", "sets": 3, "reps": "8–12", "rest_s": 60, "notes": "Doplnok."},
                ],
                "cooldown": {"minutes": 10, "notes": "Krátke vychodenie + mobilita."},
            }
            notes = "Fixný slot z weekly template. AI ho na tento deň nedalo, preto je tu bezpečný placeholder."
        elif sport == "run" and kind == "long":
            title = "Dlhý beh (fixný deň)"
            duration = 60
            session_type = "coach_override"
            intensity = "easy"
            structure = {"main": [{"work_min": 60, "notes": "Ľahko, bez tlaku."}]}
            notes = "Fixný dlhý beh z template. AI ho na tento deň nedalo, preto je tu bezpečný placeholder."
        else:
            title = "Fixný tréning"
            duration = 30
            session_type = "coach_override"
            intensity = None
            structure = None
            notes = "Fixný slot z template. AI ho na tento deň nedalo, preto je tu ľahká alternatíva."

        sessions.append(
            {
                "sport": sport,
                "title": title,
                "duration_min": duration,
                "intensity": intensity,
                "session_type": session_type,
                "zone_text": None,
                "notes": notes,
                "structure": structure,
                "targets": None,
                "payload": {
                    "fixed_slot": {
                        "weekday": weekday,
                        "sport": fs.get("sport"),
                        "kind": fs.get("kind"),
                        "policy": fs.get("policy"),
                    }
                },
            }
        )

    return daily_plan


# -----------------------------------------------------------------------------
# Strength quality normalizer (75 min, 15+45+15, 2+5+2)
# -----------------------------------------------------------------------------

def _append_note(existing: Any, extra: str) -> str:
    base = existing if isinstance(existing, str) else ""
    extra = (extra or "").strip()
    if not extra:
        return base
    if not base:
        return extra
    if extra in base:
        return base
    return base.rstrip() + " " + extra


def _strength_kind_to_minutes(kind: str) -> int:
    k = (kind or "").strip().lower()
    if k in {"compact", "short"}:
        return 45
    return 75


def normalize_strength_sessions_quality(
    daily_plan: Dict[str, Any],
    *,
    fixed_slots: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Všetky strength sessions prepíš do:
      - duration_min = 75
      - warmup 15
      - strength_exercises = 9 slotov (2 + 5 + 2)
      - cooldown 15

    Konkrétne cviky doplní mapper neskôr (exercise_id, exercise_name).
    """
    if not isinstance(daily_plan, dict):
        return daily_plan

    days = daily_plan.get("days")
    if not isinstance(days, list):
        return daily_plan

    fixed_strength_by_weekday: Dict[str, str] = {}
    for fs in fixed_slots or []:
        if not isinstance(fs, dict):
            continue
        if fs.get("policy") != "hard":
            continue
        if str(fs.get("sport")) != "strength":
            continue
        wd = str(fs.get("weekday") or "")
        if wd:
            fixed_strength_by_weekday[wd] = str(fs.get("kind") or "full")

    for day in days:
        if not isinstance(day, dict):
            continue

        wd = _weekday_abbr_from_iso(day.get("date"))
        sessions = day.get("sessions")
        if not isinstance(sessions, list):
            continue

        for s in sessions:
            if not isinstance(s, dict):
                continue
            if str(s.get("sport")) != "strength":
                continue

            kind = None
            p = s.get("payload")
            if isinstance(p, dict):
                fs2 = p.get("fixed_slot")
                if isinstance(fs2, dict) and fs2.get("sport") == "strength":
                    kind = fs2.get("kind")

            if not kind and wd and wd in fixed_strength_by_weekday:
                kind = fixed_strength_by_weekday[wd]

            kind = str(kind or "full")
            duration = _strength_kind_to_minutes(kind)

            # teraz držíme produkt konzistentný: aj compact -> 75 (kým sa nerozhodneš inak)
            if duration < 75:
                duration = 75

            s["duration_min"] = duration
            s["session_type"] = s.get("session_type") or "strength_full"
            s["intensity"] = s.get("intensity") or "moderate"
            s["title"] = s.get("title") or "Silový tréning"

            strength_exercises = [
                # Aktivácia (2)
                {"slot": "core", "sets": 2, "reps": "8–12", "rest_s": 45, "notes": "Aktivácia / kontrola trupu."},
                {"slot": "lower_posterior", "sets": 2, "reps": "8–12", "rest_s": 45, "notes": "Aktivácia zadného reťazca."},

                # Hlavná časť (5)
                {"slot": "lower_posterior", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť – sila."},
                {"slot": "lower_quad", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť – sila."},
                {"slot": "upper_pull", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť – sila."},
                {"slot": "upper_push", "sets": 3, "reps": "6–10", "rest_s": 90, "notes": "Hlavná časť – doplnok."},
                {"slot": "core", "sets": 3, "reps": "8–12", "rest_s": 60, "notes": "Hlavná časť – core."},

                # Doplnky (2)
                {"slot": "upper_pull", "sets": 2, "reps": "10–15", "rest_s": 60, "notes": "Doplnok – ľahšie, technicky."},
                {"slot": "lower_quad", "sets": 2, "reps": "10–15", "rest_s": 60, "notes": "Doplnok – ľahšie, technicky."},
            ]

            s["structure"] = {
                "warmup": {"minutes": 15, "notes": "Aktivácia + mobilita (15 min)."},
                "strength_exercises": strength_exercises,
                "cooldown": {"minutes": 15, "notes": "Mobilita + uvoľnenie (15 min)."},
            }
            s["strength_exercises"] = strength_exercises

            s["notes"] = _append_note(
                s.get("notes"),
                "Štruktúra silového tréningu bola zjednotená systémom na 75 min (15+45+15) a 2+5+2 bloky.",
            )

    return daily_plan


# -----------------------------------------------------------------------------
# Public services
# -----------------------------------------------------------------------------

def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str] = None,
    overwrite: bool = True,
    model: Optional[str] = None,
    debug: bool = False,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    jwt = user_jwt if service else require_jwt(user_jwt)

    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    if not service and is_user_over_token_quota(user_id, user_jwt=jwt, service=service):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "daily_plan": None,
            "plan_id": plan_id,
            "week_index": week_index,
            "week_start": None,
            "week_end": None,
            "state_id": None,
            "model": daily_model,
            "overwrite": overwrite,
            "inserted_rows": 0,
            "deleted_rows": 0,
            "error": {
                "code": "ai_quota_exceeded",
                "message": (
                    "Mesačný limit AI plánov bol vyčerpaný. "
                    "Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj."
                ),
                "used_tokens_this_month": used,
            },
        }

    ctx = build_daily_context_from_db(
        user_id=user_id,
        week_index=week_index,
        plan_id=plan_id,
        overwrite=overwrite,
        user_jwt=jwt,
        service=service,
    )

    context_payload = ctx["context_payload"]
    plan_id_effective: Optional[str] = ctx["plan_id_effective"]
    week_meta: Dict[str, Any] = ctx["week_meta"]
    state_row: Optional[Dict[str, Any]] = ctx["state_row"]
    prefs_ai: Dict[str, Any] = ctx["prefs_ai"]

    weekly_template = prefs_ai.get("weekly_template") or {}
    fixed_slots = _derive_fixed_slots_daily(weekly_template, max_fixed=7)
    context_payload["fixed_slots"] = fixed_slots

    daily_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )
    if not isinstance(daily_plan, dict):
        daily_plan = {}

    plan_id_out = plan_id_effective
    if plan_id_out:
        daily_plan["plan_id"] = plan_id_out

    # 1) enforce HARD fixed slots (minimal)
    try:
        daily_plan = enforce_hard_fixed_slots(daily_plan, fixed_slots)
    except Exception as e:  # noqa: BLE001
        print("[DAILY] enforce_hard_fixed_slots error:", repr(e))

    # 2) normalize ALL strength sessions quality (75min template)
    try:
        daily_plan = normalize_strength_sessions_quality(daily_plan, fixed_slots=fixed_slots)
    except Exception as e:  # noqa: BLE001
        print("[DAILY] normalize_strength_sessions_quality error:", repr(e))

    # 3) billing
    usage = extract_usage_from_trace(trace)
    billing_result: Optional[Dict[str, Any]] = None
    if usage:
        if daily_model:
            usage["model"] = daily_model
        try:
            billing_result = log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.generate_daily_plan",
                source="service" if service else "user",
                billed_via="internal",
                charge_wallet=False,
                meta={"week_index": week_index, "plan_id": plan_id_out},
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] daily_plan billing error:", repr(e))

    # 4) strength mapper – doplní konkrétne cviky
    strength_settings = prefs_ai.get("strength_settings") or {}
    available_equipment = strength_settings.get("available") or []
    if not isinstance(available_equipment, list):
        available_equipment = []

    equipment_mode = strength_settings.get("equipment_mode") or strength_settings.get("location")
    daily_plan = enrich_daily_plan_with_strength_exercises(
        user_id=user_id,
        daily_plan=daily_plan,
        available_equipment=available_equipment,
        equipment_mode=equipment_mode if isinstance(equipment_mode, str) else None,
        today=date.today(),
        weeks_back=8,
        user_jwt=jwt,
        service=service,
    )

    # 5) DB write
    deleted_rows = 0
    if overwrite and plan_id_out and week_meta.get("week_start") and week_meta.get("week_end"):
        deleted_rows = db_clear_daily_for_user_week(
            user_id=user_id,
            plan_id=plan_id_out,
            week_start=week_meta["week_start"],
            week_end=week_meta["week_end"],
            user_jwt=jwt,
            service=service,
        )

    rows_to_insert: List[Dict[str, Any]] = build_daily_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id_out,
        daily_plan=daily_plan,
    )

    inserted_rows = (
        db_insert_daily_rows(rows_to_insert, user_jwt=jwt, service=service) if rows_to_insert else 0
    )

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "plan_id": plan_id_out,
        "week_index": week_index,
        "week_start": daily_plan.get("week_start") or week_meta.get("week_start"),
        "week_end": daily_plan.get("week_end") or week_meta.get("week_end"),
        "state_id": (state_row or {}).get("id"),
        "model": daily_model,
        "overwrite": overwrite,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
    }
    if debug:
        resp["debug"] = trace
        resp["context_payload"] = context_payload
        resp["ai_usage"] = usage
        resp["billing"] = billing_result

    return resp


def service_get_daily_overview(
    user_id: int,
    horizon_days: int = 7,
    *,
    user_jwt: str,
) -> Dict[str, Any]:
    jwt = require_jwt(user_jwt)

    if horizon_days <= 0:
        horizon_days = 7

    meta = db_get_active_plan_meta_for_user(user_id=user_id, user_jwt=jwt) or db_get_latest_plan_meta_for_user(
        user_id=user_id, user_jwt=jwt
    )

    plan_id: Optional[str] = meta.get("plan_id") if isinstance(meta, dict) else None

    rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            horizon_days=horizon_days,
            plan_id=plan_id,
            user_jwt=jwt,
        )
        or []
    )

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        d = r.get("plan_date")
        if not d:
            continue
        by_date.setdefault(str(d)[:10], []).append(r)

    days_out: List[Dict[str, Any]] = []
    for date_str, sessions in sorted(by_date.items(), key=lambda kv: kv[0]):
        sessions_out: List[Dict[str, Any]] = []
        for s in sorted(sessions, key=lambda x: int(x.get("session_index") or 0)):
            payload = s.get("payload") or {}
            structure = s.get("structure") or payload.get("structure")

            if structure is None:
                strength_ex = s.get("strength_exercises") or payload.get("strength_exercises")
                if strength_ex:
                    structure = {"strength_exercises": strength_ex}

            sessions_out.append(
                {
                    "sport": s.get("sport") or "other",
                    "title": s.get("title"),
                    "duration_min": s.get("duration_min"),
                    "intensity": s.get("intensity"),
                    "zone_text": s.get("zone_text"),
                    "notes": s.get("notes"),
                    "session_type": s.get("session_type"),
                    "structure": structure,
                    "payload": payload,
                }
            )

        days_out.append({"date": date_str, "sessions": sessions_out})

    return {"horizon_days": horizon_days, "days": days_out}


def service_auto_extend_daily_plan(
    user_id: int,
    *,
    min_horizon_days: int = 6,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    jwt = user_jwt if service else require_jwt(user_jwt)

    if min_horizon_days <= 0:
        min_horizon_days = 6

    today = date.today()

    meta = db_get_active_plan_meta_for_user(user_id=user_id, user_jwt=jwt, service=service) or db_get_latest_plan_meta_for_user(
        user_id=user_id, user_jwt=jwt, service=service
    )
    plan_id: Optional[str] = meta.get("plan_id") if isinstance(meta, dict) else None
    if not plan_id:
        return {"changed": False, "reason": "no_plan"}

    daily_rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS,
            plan_id=plan_id,
            user_jwt=jwt,
            service=service,
        )
        or []
    )
    if not daily_rows:
        return {"changed": False, "reason": "no_daily_rows"}

    last_date_str = max(str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date"))
    last_date = date.fromisoformat(last_date_str)
    days_left = (last_date - today).days

    if days_left >= min_horizon_days:
        return {
            "changed": False,
            "reason": "enough_horizon",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    weekly_rows: List[Dict[str, Any]] = (
        db_get_weekly_for_user_plan(
            user_id=user_id,
            plan_id=plan_id,
            user_jwt=jwt,
            service=service,
        )
        or []
    )
    if not weekly_rows:
        return {
            "changed": False,
            "reason": "no_weekly_rows",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    weekly_sorted = sorted(weekly_rows, key=lambda w: int(w.get("week_index") or 0))

    current_week_index: Optional[int] = None
    for w in weekly_sorted:
        ws_raw = w.get("week_start")
        we_raw = w.get("week_end") or ws_raw
        if not isinstance(ws_raw, str) or not isinstance(we_raw, str):
            continue
        try:
            ws = date.fromisoformat(ws_raw[:10])
            we = date.fromisoformat(we_raw[:10])
        except Exception:
            continue
        if ws <= last_date <= we:
            current_week_index = int(w.get("week_index") or 0)
            break

    if current_week_index is None:
        return {
            "changed": False,
            "reason": "cannot_determine_current_week",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    future_weeks = [w for w in weekly_sorted if int(w.get("week_index") or 0) > current_week_index]
    if not future_weeks:
        return {
            "changed": False,
            "reason": "no_future_weeks",
            "current_week_index": current_week_index,
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    generated: List[int] = []
    current_last_str = last_date_str

    for w in future_weeks:
        week_idx = int(w.get("week_index") or 0)

        _ = service_generate_daily_week(
            user_id=user_id,
            week_index=week_idx,
            plan_id=plan_id,
            overwrite=True,
            model=None,
            debug=False,
            user_jwt=jwt,
            service=service,
        )
        generated.append(week_idx)

        daily_rows = (
            db_list_daily_for_user_horizon(
                user_id=user_id,
                horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS,
                plan_id=plan_id,
                user_jwt=jwt,
                service=service,
            )
            or []
        )

        current_last_str = max(str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date"))
        current_last_date = date.fromisoformat(current_last_str)
        days_left = (current_last_date - today).days

        if days_left >= min_horizon_days:
            break

    return {
        "changed": bool(generated),
        "generated_weeks": generated,
        "current_week_index": current_week_index,
        "final_days_left": days_left,
        "last_daily_date": current_last_str,
        "plan_id": plan_id,
    }