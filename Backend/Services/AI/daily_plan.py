# ===== Services/AI/daily_plan.py =====
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

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
# DEBUG (forced ON) -> "cebuf=1"
# -----------------------------------------------------------------------------
_DEBUG_ENABLED = True


def _dprint(*parts: Any) -> None:
    if not _DEBUG_ENABLED and os.getenv("DAILY_DEBUG", "0") not in ("1", "true", "True"):
        return
    try:
        msg = " ".join(str(p) for p in parts)
        print(f"[DAILY] {msg}")
    except Exception:
        pass


def _safe_dict(x: Any) -> Dict[str, Any]:
    return x if isinstance(x, dict) else {}


def _summarize_day_constraints(context_payload: Dict[str, Any]) -> str:
    dcs = context_payload.get("day_constraints") or []
    if not isinstance(dcs, list) or not dcs:
        return "day_constraints:<missing/empty>"
    parts: List[str] = []
    for dc in dcs:
        if not isinstance(dc, dict):
            continue
        ds = str(dc.get("date") or "")[:10]
        if not ds:
            continue
        open_slots = dc.get("open_slots")
        max_s = dc.get("max_sessions")
        locks = dc.get("locks") or []
        locks_n = len(locks) if isinstance(locks, list) else "na"
        parts.append(f"{ds}:{open_slots}/{max_s}/locks={locks_n}")
    return "day_constraints: " + ", ".join(parts)


# -----------------------------------------------------------------------------
# Strength quality normalizer (75 min, 15+45+15, 2+5+2)  [KEEP]
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


def normalize_strength_sessions_quality(daily_plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Zjednotí VŠETKY strength sessions na konzistentnú šablónu (cca 75 min, 2+5+2).
    Konkrétne cviky doplní mapper neskôr (exercise_id, exercise_name).
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

            # drž konzistentný produkt (zatiaľ vždy 75)
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
            s["strength_exercises"] = strength_exercises

            s["notes"] = _append_note(
                s.get("notes"),
                "Štruktúra silového tréningu bola zjednotená systémom na 75 min (15+45+15) a 2+5+2 bloky.",
            )

    return daily_plan


# -----------------------------------------------------------------------------
# Day-constraints materializer (LOCKS + AI FREE SESSIONS -> FULL WEEK PLAN)
# -----------------------------------------------------------------------------

_ALLOWED_SPORT_ENUM = {"run", "ride", "strength", "swim", "other"}


def _safe_list(x: Any) -> List[Any]:
    return x if isinstance(x, list) else []


def _make_lock_session(
    lock: Dict[str, Any],
    date_str: str,
    *,
    dc_weekday: Optional[str] = None,
) -> Dict[str, Any]:
    src = str(lock.get("source") or "")
    kind = lock.get("kind")

    if src == "external_events":
        sport_out = str(lock.get("session_sport") or "other")
        if sport_out not in _ALLOWED_SPORT_ENUM:
            sport_out = "other"
        real_sport = str(lock.get("sport_raw") or "other")
    else:
        sport_raw = str(lock.get("sport") or "other")
        sport_out = sport_raw if sport_raw in _ALLOWED_SPORT_ENUM else "other"
        real_sport = sport_raw

    title = lock.get("title")
    if not isinstance(title, str) or not title.strip():
        if src == "external_events":
            title = "Externá aktivita"
        else:
            if real_sport == "strength":
                title = "Silový tréning (fixný)"
            elif real_sport == "run" and kind == "long":
                title = "Dlhý beh (fixný)"
            else:
                title = "Fixný tréning"

    dur = lock.get("duration_min")
    if not isinstance(dur, (int, float)) or dur <= 0:
        if real_sport == "strength":
            dur = 75
        elif real_sport == "run" and kind == "long":
            dur = 90
        else:
            dur = 60

    sess: Dict[str, Any] = {
        "sport": sport_out,
        "title": title,
        "duration_min": int(dur),
        "intensity": lock.get("intensity"),
        "session_type": lock.get("session_type"),
        "zone_text": lock.get("zone_text"),
        "notes": lock.get("notes"),
        "structure": lock.get("structure") or {},
        "payload": {},
    }

    if src == "weekly_template":
        sess["payload"]["fixed_slot"] = {
            "weekday": lock.get("weekday") or dc_weekday,
            "sport": lock.get("sport"),
            "kind": lock.get("kind"),
            "policy": lock.get("policy") or "hard",
        }
        sess["session_type"] = sess.get("session_type") or "coach_override"
        sess["notes"] = _append_note(sess.get("notes"), "Fixný tréning z weekly template (nepresúva sa).")

    if src == "external_events":
        sess["payload"]["external_event"] = {
            "date": date_str,
            "weekday": lock.get("weekday") or dc_weekday,
            "sport": real_sport,
            "title": lock.get("title") or title,
            "duration_min": int(dur),
            "start_time_local": lock.get("start_time_local"),
            "priority": lock.get("priority"),
        }
        sess["session_type"] = sess.get("session_type") or "external_event"
        sess["notes"] = _append_note(sess.get("notes"), "Externá udalosť (nepresúva sa).")

    return sess


def _index_free_sessions_by_date(ai_plan: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {}
    for d in _safe_list(ai_plan.get("days")):
        if not isinstance(d, dict):
            continue
        ds = str(d.get("date") or "")[:10]
        if not ds:
            continue
        sessions = d.get("sessions")
        if sessions is None:
            sessions = []
        if not isinstance(sessions, list):
            sessions = []
        out[ds] = [s for s in sessions if isinstance(s, dict)]
    return out


def _materialize_full_week_plan_from_constraints(
    *,
    context_payload: Dict[str, Any],
    ai_free_plan: Dict[str, Any],
    plan_id: Optional[str],
    week_index: int,
    week_start: Optional[str],
    week_end: Optional[str],
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Build final daily_plan:
      - dates from day_constraints (date truth)
      - sessions = lock_sessions + ai_free_sessions
      - session_index set deterministically

    IMPORTANT:
      open_slots is a CAP (max), not a MUST-fill requirement.
      i.e. AI may return 0..open_slots free sessions.
    """
    warnings: List[str] = []

    day_constraints = context_payload.get("day_constraints") or []
    if not isinstance(day_constraints, list) or not day_constraints:
        out = ai_free_plan if isinstance(ai_free_plan, dict) else {}
        out.setdefault("week_index", week_index)
        if week_start:
            out.setdefault("week_start", week_start)
        if week_end:
            out.setdefault("week_end", week_end)
        if plan_id:
            out["plan_id"] = plan_id
        return out, warnings

    free_by_date = _index_free_sessions_by_date(ai_free_plan)

    out_days: List[Dict[str, Any]] = []
    for dc in day_constraints:
        if not isinstance(dc, dict):
            continue

        ds = str(dc.get("date") or "")[:10]
        if not ds:
            continue

        dc_weekday = dc.get("weekday")
        locks = dc.get("locks") or []
        locks = locks if isinstance(locks, list) else []

        max_sessions = dc.get("max_sessions")
        if not isinstance(max_sessions, int) or max_sessions < 0:
            max_sessions = 0

        lock_sessions: List[Dict[str, Any]] = []
        for lock in locks:
            if not isinstance(lock, dict):
                continue
            lock_sessions.append(_make_lock_session(lock, ds, dc_weekday=dc_weekday))

        # SOURCE OF TRUTH: open_slots from builder
        if isinstance(dc.get("open_slots"), int):
            open_slots = int(dc.get("open_slots") or 0)
            if open_slots < 0:
                open_slots = 0
        else:
            # fallback only if open_slots missing
            open_slots = max_sessions - len(lock_sessions)
            if open_slots < 0:
                open_slots = 0
                warnings.append(f"{ds}: locks exceed max_sessions (server kept locks only).")

        free_sessions = free_by_date.get(ds, [])
        # CAP only: if AI returned more than allowed, trim.
        if len(free_sessions) > open_slots:
            warnings.append(f"{ds}: free_sessions_count={len(free_sessions)} > open_slots={open_slots} (trimmed).")
            free_sessions = free_sessions[:open_slots]

        # enforce payload hygiene (free sessions must not carry lock payloads)
        cleaned_free: List[Dict[str, Any]] = []
        for s in free_sessions:
            if not isinstance(s, dict):
                continue
            payload = s.get("payload")
            if isinstance(payload, dict) and ("fixed_slot" in payload or "external_event" in payload):
                payload = dict(payload)
                payload.pop("fixed_slot", None)
                payload.pop("external_event", None)
                s["payload"] = payload
                s["notes"] = _append_note(
                    s.get("notes"),
                    "Pozn.: systém odstránil lock-payload z voľnej session (vyhradené pre fixné/externé bloky).",
                )
            cleaned_free.append(s)

        merged = lock_sessions + cleaned_free

        # enforce max_sessions safety (should not be needed, but keep it)
        if isinstance(max_sessions, int) and max_sessions >= 0 and len(merged) > max_sessions:
            warnings.append(f"{ds}: merged_sessions={len(merged)} > max_sessions={max_sessions} (trimmed).")
            merged = merged[:max_sessions]

        for idx, s in enumerate(merged):
            if isinstance(s, dict):
                s["session_index"] = idx

        out_days.append({"date": ds, "sessions": merged})

    daily_out: Dict[str, Any] = {
        "schema_version": int(ai_free_plan.get("schema_version") or 2),
        "generated_at": ai_free_plan.get("generated_at"),
        "model": ai_free_plan.get("model"),
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "days": out_days,
    }
    if plan_id:
        daily_out["plan_id"] = plan_id

    if warnings:
        daily_out["warnings"] = warnings

    return daily_out, warnings

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
    if os.getenv("DAILY_DEBUG", "0") in ("1", "true", "True"):
        debug = True

    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    _dprint("=== service_generate_daily_week start ===")
    _dprint("user_id=", user_id, "| week_index=", week_index, "| plan_id_in=", plan_id, "| overwrite=", overwrite, "| model=", daily_model, "| debug=", debug, "| service=", service)

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

    # 1) context z buildera (obsahuje day_constraints + external occurrences)
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
    _dprint(_summarize_day_constraints(context_payload))

    # 2) LLM -> AI FREE sessions plan (NEW CONTRACT)
    ai_free_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )
    if not isinstance(ai_free_plan, dict):
        ai_free_plan = {}

    plan_id_out = plan_id_effective
    week_start = str(week_meta.get("week_start") or ai_free_plan.get("week_start") or "") or None
    week_end = str(week_meta.get("week_end") or ai_free_plan.get("week_end") or "") or None

    _dprint("ai_free_plan meta:", "model=", ai_free_plan.get("model"), "| generated_at=", ai_free_plan.get("generated_at"), "| week_start=", week_start, "| week_end=", week_end)
    _dprint("ai_free_plan days=", (len(ai_free_plan.get("days") or []) if isinstance(ai_free_plan.get("days"), list) else "na"))

    # 2b) Materialize FULL plan from day_constraints (LOCKS + AI FREE)
    daily_plan, materialize_warnings = _materialize_full_week_plan_from_constraints(
        context_payload=context_payload,
        ai_free_plan=ai_free_plan,
        plan_id=plan_id_out,
        week_index=week_index,
        week_start=week_start,
        week_end=week_end,
    )

    _dprint("materialize:", "days=", (len(daily_plan.get("days") or []) if isinstance(daily_plan.get("days"), list) else "na"), "| warnings=", len(materialize_warnings))

    # 3) normalize strength sessions (kvalita šablóny) – bez presúvania dní
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
                meta={"week_index": week_index, "plan_id": plan_id_out},
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

    # 6) DB write
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
    _dprint("db_clear:", "deleted_rows=", deleted_rows)

    rows_to_insert: List[Dict[str, Any]] = build_daily_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id_out,
        daily_plan=daily_plan,
    )
    _dprint("rows_to_insert=", len(rows_to_insert))

    inserted_rows = db_insert_daily_rows(rows_to_insert, user_jwt=jwt, service=service) if rows_to_insert else 0
    _dprint("db_insert:", "inserted_rows=", inserted_rows)

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
    if materialize_warnings:
        resp["warnings"] = materialize_warnings

    if debug:
        resp["debug"] = trace
        resp["context_payload"] = context_payload
        resp["ai_usage"] = usage
        resp["billing"] = billing_result
        resp["ai_free_plan"] = ai_free_plan
        if materialize_warnings:
            resp["materialize_warnings"] = materialize_warnings

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