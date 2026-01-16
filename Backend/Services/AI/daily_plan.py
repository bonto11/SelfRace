# ===== Services/AI/daily_plan.py (doplnky + fixy) =====
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import date, date as _date

from Configs.config import DEFAULT_MODEL, COACH_PLAN_SCAN_HORIZON_DAYS
from Services.AI.daily_plan_builders import (
    build_daily_rows_from_ai,
    build_daily_context_from_db,
)
from Services.AI.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)

from Routes_DB.coach_plan_weekly import db_get_weekly_for_user_plan
from Routes_DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_clear_daily_for_user_week,
    db_list_daily_for_user_horizon,
)
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_AI.daily_plan_generate import generate_daily_week_json
from Services.coach_strength_mapper import enrich_daily_plan_with_strength_exercises
from Services.users import require_jwt

# ---------------- fixed-slot derivation (local copy) ----------------

WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6,
}

def _derive_fixed_slots_daily(
    weekly_template: Dict[str, Any],
    max_fixed: int = 7,
) -> List[Dict[str, Any]]:
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


_WEEKDAY_TO_ABBR = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

def _weekday_abbr_from_iso(d: Optional[str]) -> Optional[str]:
    try:
        if not d:
            return None
        dd = _date.fromisoformat(str(d)[:10])
        return _WEEKDAY_TO_ABBR.get(dd.weekday())
    except Exception:
        return None

def _ensure_payload_dict(s: Dict[str, Any]) -> Dict[str, Any]:
    p = s.get("payload")
    if isinstance(p, dict):
        return p
    p = {}
    s["payload"] = p
    return p

def _append_note(existing: Optional[str], extra: str) -> str:
    base = (existing or "").strip()
    if not base:
        return extra
    if extra in base:
        return base
    return base + "\n" + extra

def _matches_fixed_slot_session(s: Dict[str, Any], fs: Dict[str, Any], weekday: str) -> bool:
    if not isinstance(s, dict) or not isinstance(fs, dict):
        return False

    # strict match by payload.fixed_slot
    p = s.get("payload")
    if isinstance(p, dict):
        f = p.get("fixed_slot")
        if isinstance(f, dict):
            return (
                str(f.get("weekday")) == weekday
                and str(f.get("sport")) == str(fs.get("sport"))
                and str(f.get("kind")) == str(fs.get("kind"))
            )

    # fallback: match by sport
    return str(s.get("sport")) == str(fs.get("sport"))


def enforce_hard_fixed_slots_no_extra_sessions(
    daily_plan: Dict[str, Any],
    fixed_slots: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    HARD fixed slots musí coach "rešpektovať", ale:
    - NEPRIDÁVAME druhý tréning navyše.
    - Ak chýba matching session, otagujeme existujúci session na tom dni
      a doplníme poznámku, že fixed slot sa nedal naplniť presne (coach_override).
    """
    if not isinstance(daily_plan, dict):
        return daily_plan

    days = daily_plan.get("days")
    if not isinstance(days, list) or not days:
        return daily_plan

    hard_slots = [fs for fs in fixed_slots if isinstance(fs, dict) and fs.get("policy") == "hard"]
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
        if not isinstance(sessions, list) or not sessions:
            # schema síce hovorí non-empty, ale keby nie:
            day["sessions"] = [{
                "sport": "other",
                "title": "Voľno",
                "duration_min": 0,
                "intensity": None,
                "session_type": "rest_day",
                "zone_text": None,
                "notes": "Doplnené systémom, lebo deň nemal žiadny session.",
                "structure": None,
                "targets": None,
                "payload": {},
            }]
            sessions = day["sessions"]

        # 1) ak existuje matching, len ho otaguj
        for s in sessions:
            if _matches_fixed_slot_session(s, fs, weekday):
                payload = _ensure_payload_dict(s)
                payload.setdefault("fixed_slot", {
                    "weekday": weekday,
                    "sport": fs.get("sport"),
                    "kind": fs.get("kind"),
                    "policy": fs.get("policy"),
                })
                return daily_plan  # matching slot splnený

        # 2) inak NEDÁVAJ nový session. Otagní prvý a pridaj poznámku.
        target = sessions[0]
        payload = _ensure_payload_dict(target)
        payload["fixed_slot"] = {
            "weekday": weekday,
            "sport": fs.get("sport"),
            "kind": fs.get("kind"),
            "policy": fs.get("policy"),
            "missing_exact_match": True,
        }
        target["session_type"] = target.get("session_type") or "coach_override"
        target["notes"] = _append_note(
            target.get("notes"),
            f"Fixný deň z template ({weekday}: {fs.get('sport')}/{fs.get('kind')}). "
            "Presný tréning sa sem nedal rozumne vložiť bez zhoršenia regenerácie, preto je tu bezpečnejšia úprava."
        )

    return daily_plan


# ---------------- strength quality normalizer ----------------

def _strength_kind_to_minutes(kind: str) -> int:
    # zatiaľ všetko full = 75, compact môžeš neskôr spraviť 45
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
    Cviky sa doplnia mapperom neskôr (exercise_id, exercise_name).
    """
    if not isinstance(daily_plan, dict):
        return daily_plan
    days = daily_plan.get("days")
    if not isinstance(days, list):
        return daily_plan

    # map fixed kind per weekday (ak máš hard fixed strength s kind)
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

            # decide kind -> minutes
            kind = None
            # ak je tam fixed_slot, použi jeho kind
            p = s.get("payload")
            if isinstance(p, dict):
                fs = p.get("fixed_slot")
                if isinstance(fs, dict) and fs.get("sport") == "strength":
                    kind = fs.get("kind")
            # fallback: hard fixed strength na daný weekday
            if not kind and wd and wd in fixed_strength_by_weekday:
                kind = fixed_strength_by_weekday[wd]
            kind = str(kind or "full")

            duration = _strength_kind_to_minutes(kind)
            if duration < 75:
                # compact zatiaľ necháme tiež 75, aby si mal konzistentný produkt
                duration = 75

            s["duration_min"] = duration
            s["session_type"] = s.get("session_type") or "strength_full"
            s["intensity"] = s.get("intensity") or "moderate"
            s["title"] = s.get("title") or "Silový tréning"

            # QUALITY TEMPLATE: 15 + 45 + 15, 2+5+2
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

            # Poznámka len keď LLM malo niečo slabé
            s["notes"] = _append_note(
                s.get("notes"),
                "Štruktúra silového tréningu bola zjednotená systémom na 75 min (15+45+15) a 2+5+2 bloky."
            )

    return daily_plan


# ---------------- service_generate_daily_week (iba relevantné vloženia) ----------------

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
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

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

    # derive fixed slots from prefs_ai.weekly_template
    weekly_template = prefs_ai.get("weekly_template") or {}
    fixed_slots = _derive_fixed_slots_daily(weekly_template, max_fixed=7)
    context_payload["fixed_slots"] = fixed_slots  # aby to videlo aj LLM

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

    # 1) enforce hard fixed slots – bez extra sessions
    try:
        daily_plan = enforce_hard_fixed_slots_no_extra_sessions(daily_plan, fixed_slots)
    except Exception as e:
        print("[DAILY] enforce_hard_fixed_slots error:", repr(e))

    # 2) normalize strength quality (75min, 2+5+2)
    try:
        daily_plan = normalize_strength_sessions_quality(daily_plan, fixed_slots=fixed_slots)
    except Exception as e:
        print("[DAILY] normalize_strength_sessions_quality error:", repr(e))

    # billing (nezmenené)
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
        except Exception as e:
            print("[AI_BILLING] daily_plan billing error:", repr(e))

    # strength mapper – doplní exercise_id + name
    strength_settings = prefs_ai.get("strength_settings") or {}
    available_equipment = strength_settings.get("available") or []
    if not isinstance(available_equipment, list):
        available_equipment = []

    daily_plan = enrich_daily_plan_with_strength_exercises(
        user_id=user_id,
        daily_plan=daily_plan,
        available_equipment=available_equipment,
        today=date.today(),
        weeks_back=8,
        user_jwt=jwt,
        service=service,
    )

    # DB write (nezmenené)
    deleted_rows = 0
    if overwrite and plan_id_out and week_meta["week_start"] and week_meta["week_end"]:
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
        db_insert_daily_rows(rows_to_insert, user_jwt=jwt, service=service)
        if rows_to_insert else 0
    )

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "plan_id": plan_id_out,
        "week_index": week_index,
        "week_start": daily_plan.get("week_start") or week_meta["week_start"],
        "week_end": daily_plan.get("week_end") or week_meta["week_end"],
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