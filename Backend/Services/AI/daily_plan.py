# ===== Services/AI/daily_plan.py =====
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

import os
import json

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
# DEBUG (env-controlled)
# -----------------------------------------------------------------------------
# zapnes:
#   DAILY_DEBUG=1
# vypnes:
#   DAILY_DEBUG=0
_DEBUG_ENABLED = str(os.getenv("DAILY_DEBUG", "0") or "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _dprint(*parts: Any) -> None:
    if not _DEBUG_ENABLED:
        return
    try:
        msg = " ".join(str(p) for p in parts)
        print(f"[DAILY] {msg}")
    except Exception:
        pass


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


def _reindex_sessions_per_day(daily_plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Make session_index deterministic and clean.
    Prevents AI from returning weird/duplicate indices that break FE sorting.
    """
    if not isinstance(daily_plan, dict):
        return daily_plan
    days = daily_plan.get("days")
    if not isinstance(days, list):
        return daily_plan

    for day in days:
        if not isinstance(day, dict):
            continue
        sessions = day.get("sessions")
        if not isinstance(sessions, list):
            continue
        # keep only dict sessions for indexing
        dict_sessions = [s for s in sessions if isinstance(s, dict)]
        for i, s in enumerate(dict_sessions):
            s["session_index"] = i
        day["sessions"] = dict_sessions

    return daily_plan


# -----------------------------------------------------------------------------
# Strength quality normalizer (KEEP)
# -----------------------------------------------------------------------------
def normalize_strength_sessions_quality(daily_plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Zjednotí VŠETKY strength sessions na konzistentnú šablónu (cca 75 min, 2+5+2).
    Konkrétne cviky doplní mapper neskôr (exercise_id, exercise_name).

    IMPORTANT:
    - Do NOT touch external events (payload.external_event) even if sport=strength.
      External events are DB truth.
    """
    if not isinstance(daily_plan, dict):
        return daily_plan

    days = daily_plan.get("days")
    if not isinstance(days, list):
        return daily_plan

    for day in days:
        if not isinstance(day, dict):
            continue

        sessions = day.get("sessions")
        if not isinstance(sessions, list):
            continue

        for s in sessions:
            if not isinstance(s, dict):
                continue
            if str(s.get("sport")) != "strength":
                continue

            # --- CRITICAL: don't normalize external events ---
            payload = s.get("payload") or {}
            if isinstance(payload, dict) and isinstance(payload.get("external_event"), dict):
                continue
            if str(s.get("session_type") or "").strip().lower() == "external_event":
                continue

            # konzistentný produkt (zatiaľ vždy 75)
            s["duration_min"] = 75
            s["session_type"] = s.get("session_type") or "strength_full"
            s["intensity"] = s.get("intensity") or "moderate"
            s["title"] = s.get("title") or "Silový tréning"

            strength_exercises = [
                {"slot": "core", "sets": 2, "reps": "8–12", "rest_s": 45, "notes": "Aktivácia / kontrola trupu."},
                {"slot": "lower_posterior", "sets": 2, "reps": "8–12", "rest_s": 45, "notes": "Aktivácia zadného reťazca."},

                {"slot": "lower_posterior", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť – sila."},
                {"slot": "lower_quad", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť – sila."},
                {"slot": "upper_pull", "sets": 4, "reps": "4–6", "rest_s": 120, "notes": "Hlavná časť – sila."},
                {"slot": "upper_push", "sets": 3, "reps": "6–10", "rest_s": 90, "notes": "Hlavná časť – doplnok."},
                {"slot": "core", "sets": 3, "reps": "8–12", "rest_s": 60, "notes": "Hlavná časť – core."},

                {"slot": "upper_pull", "sets": 2, "reps": "10–15", "rest_s": 60, "notes": "Doplnok – ľahšie, technicky."},
                {"slot": "lower_quad", "sets": 2, "reps": "10–15", "rest_s": 60, "notes": "Doplnok – ľahšie, technicky."},
            ]

            s["structure"] = {
                "warmup": {"minutes": 15, "notes": "Aktivácia + mobilita (15 min)."},
                "strength_exercises": strength_exercises,
                "cooldown": {"minutes": 15, "notes": "Mobilita + uvoľnenie (15 min)."},
            }

            # optional redundancy for FE compatibility if you rely on it
            s["strength_exercises"] = strength_exercises

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

    # allow forcing debug on Railway without FE
    if str(os.getenv("DAILY_DEBUG", "0") or "").strip().lower() in {"1", "true", "yes", "on"}:
        debug = True

    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    _dprint("=== service_generate_daily_week start ===")
    _dprint(
        "user_id=",
        user_id,
        "| week_index=",
        week_index,
        "| plan_id_in=",
        plan_id,
        "| overwrite=",
        overwrite,
        "| model=",
        daily_model,
        "| debug=",
        debug,
        "| service=",
        service,
    )

    # quota only for non-service calls
    if not service and is_user_over_token_quota(user_id, user_jwt=jwt, service=service):
        used = get_user_monthly_usage_tokens(user_id)
        _dprint("quota exceeded:", used)
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

    # 1) context z buildera (NEW: no day_constraints; external events are in context for AI)
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

    _dprint("plan_id_effective=", plan_id_effective)
    _dprint("week_meta=", json.dumps(week_meta, ensure_ascii=False))

    # 2) LLM -> FULL weekly plan (AI must include external events)
    ai_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )
    if not isinstance(ai_plan, dict):
        ai_plan = {}

    week_start = str(week_meta.get("week_start") or ai_plan.get("week_start") or "") or None
    week_end = str(week_meta.get("week_end") or ai_plan.get("week_end") or "") or None

    # Ensure minimal meta
    ai_plan.setdefault("week_index", week_index)
    if week_start:
        ai_plan.setdefault("week_start", week_start)
    if week_end:
        ai_plan.setdefault("week_end", week_end)
    if plan_id_effective:
        ai_plan["plan_id"] = plan_id_effective

    _dprint(
        "ai_plan meta:",
        "model=",
        ai_plan.get("model"),
        "| generated_at=",
        ai_plan.get("generated_at"),
        "| week_start=",
        week_start,
        "| week_end=",
        week_end,
        "| days=",
        (len(ai_plan.get("days") or []) if isinstance(ai_plan.get("days"), list) else "na"),
    )

    daily_plan = ai_plan

    # --- Safety: do not overwrite DB with empty plan ---
    days_n = len(daily_plan.get("days") or []) if isinstance(daily_plan.get("days"), list) else 0
    if days_n == 0:
        return {
            "daily_plan": daily_plan,
            "plan_id": plan_id_effective,
            "week_index": week_index,
            "week_start": week_start,
            "week_end": week_end,
            "state_id": (state_row or {}).get("id"),
            "model": daily_model,
            "overwrite": overwrite,
            "inserted_rows": 0,
            "deleted_rows": 0,
            "error": {"code": "daily_plan_empty", "message": "AI vrátil prázdny plán pre týždeň."},
            "warnings": ["daily_plan_empty"],
        }

    # 3) normalize strength sessions (quality template) – no date moving
    try:
        daily_plan = normalize_strength_sessions_quality(daily_plan)
    except Exception as e:  # noqa: BLE001
        _dprint("normalize_strength_sessions_quality error:", repr(e))

    # 4) billing
    usage = extract_usage_from_trace(trace)
    _dprint("usage extracted:", json.dumps(usage or {}, ensure_ascii=False))
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
                meta={"week_index": week_index, "plan_id": plan_id_effective},
            )
        except Exception as e:  # noqa: BLE001
            _dprint("[AI_BILLING] daily_plan billing error:", repr(e))

    # 5) strength mapper – doplní konkrétne cviky
    strength_settings = (prefs_ai.get("strength_settings") or {}) if isinstance(prefs_ai, dict) else {}
    available_equipment = strength_settings.get("available") or []
    if not isinstance(available_equipment, list):
        available_equipment = []

    equipment_mode = strength_settings.get("equipment_mode") or strength_settings.get("location")

    _dprint("strength_mapper:", "equipment_mode=", equipment_mode, "| available_equipment=", available_equipment)

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

    # Ensure stable ordering for FE + DB
    daily_plan = _reindex_sessions_per_day(daily_plan)

    # 6) DB write
    deleted_rows = 0
    if overwrite and plan_id_effective and week_meta.get("week_start") and week_meta.get("week_end"):
        deleted_rows = db_clear_daily_for_user_week(
            user_id=user_id,
            plan_id=plan_id_effective,
            week_start=week_meta["week_start"],
            week_end=week_meta["week_end"],
            user_jwt=jwt,
            service=service,
        )
    _dprint("db_clear:", "deleted_rows=", deleted_rows)

    rows_to_insert: List[Dict[str, Any]] = build_daily_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id_effective,
        daily_plan=daily_plan,
    )
    _dprint("rows_to_insert=", len(rows_to_insert))

    inserted_rows = db_insert_daily_rows(rows_to_insert, user_jwt=jwt, service=service) if rows_to_insert else 0
    _dprint("db_insert:", "inserted_rows=", inserted_rows)

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "plan_id": plan_id_effective,
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
        resp["ai_plan_raw"] = ai_plan

    _dprint("=== service_generate_daily_week done ===")
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