# Services/coach_plan_daily.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from Routes_DB.coach_plan_daily import (
    db_insert_planned_sessions,
    db_clear_range_for_user,
)
from Services.coach_plan_log import (
    service_parse_iso_date,
    service_canonical_sport,
    service_hr_zone_text,
)


# ───────────────────────────── public API ─────────────────────────────


def service_generate_daily_week(
    user_id: int,
    *,
    plan_id: str,
    week_context: Dict[str, Any],
    athlete_state: Dict[str, Any],
    prefs: Dict[str, Any],
    existing_days: Optional[List[Dict[str, Any]]] = None,
    model: str = "coach-daily-week-stub",
    overwrite: bool = True,
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Vygeneruje detailný plán na 1 týždeň (7 dní) a (voliteľne) uloží
    sessions do coach_plan_daily.

    week_context:
      - objekt z CoachWeeklyPlan.weeks[i]

    Return:
      {
        "plan_id": str,
        "week_index": int,
        "start": date,
        "end": date,
        "daily_plan": {...},        # CoachDailyWeekPlan JSON
        "inserted": int,           # počet uložených sessions (ak save_to_db=True)
      }
    """
    daily_input = build_daily_week_input(
        user_id=user_id,
        plan_id=plan_id,
        week_context=week_context,
        athlete_state=athlete_state,
        prefs=prefs,
        existing_days=existing_days,
    )

    daily_plan = call_llm_generate_daily_week(
        daily_input,
        model=model,
        debug=debug,
    )

    days = daily_plan.get("days") or []
    if not days:
        return {
            "plan_id": plan_id,
            "week_index": int(week_context.get("week_index") or 0),
            "start": None,
            "end": None,
            "daily_plan": daily_plan,
            "inserted": 0,
        }

    # range týždňa
    all_dates = [service_parse_iso_date(str(d["day"])) for d in days]
    start_d = min(all_dates)
    end_d = max(all_dates)

    inserted = 0
    if save_to_db:
        if overwrite:
            db_clear_range_for_user(
                user_id=user_id,
                start_iso=start_d.isoformat(),
                end_iso=end_d.isoformat(),
            )
        rows = daily_week_to_db_rows(
            user_id=user_id,
            plan_id=plan_id,
            daily_plan=daily_plan,
        )
        inserted = db_insert_planned_sessions(rows)

    return {
        "plan_id": plan_id,
        "week_index": int(week_context.get("week_index") or 0),
        "start": start_d,
        "end": end_d,
        "daily_plan": daily_plan,
        "inserted": inserted,
    }


# ───────────────────────────── build input (stub) ─────────────────────────────


def build_daily_week_input(
    user_id: int,
    *,
    plan_id: str,
    week_context: Dict[str, Any],
    athlete_state: Dict[str, Any],
    prefs: Dict[str, Any],
    existing_days: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Poskladá CoachDailyWeekInput z weekly week_context + athlete_state + prefs.
    """
    return {
        "schema_version": 1,
        "week": {
            "week_index": week_context.get("week_index"),
            "week_start": week_context.get("week_start"),
            "week_end": week_context.get("week_end"),
            "goal": week_context.get("goal"),
            "focus": week_context.get("focus"),
            "load_phase": week_context.get("load_phase"),
            "planned_km": week_context.get("planned_km"),
            "planned_minutes": week_context.get("planned_minutes"),
            "sessions_summary": week_context.get("sessions_summary"),
            "key_sessions": week_context.get("key_sessions"),
        },
        "prefs": {
            "main_sport": prefs.get("main_sport") or "run",
            "strength_settings": prefs.get("strength_settings") or {},
            "constraints": prefs.get("constraints") or {},
        },
        "athlete_state": (athlete_state or {}).get("ai_state") or {},
        "existing_days": existing_days or [],
        "meta": {
            "user_id": user_id,
            "plan_id": plan_id,
        },
    }


# ───────────────────────────── LLM stub ─────────────────────────────


def call_llm_generate_daily_week(
    payload: Dict[str, Any],
    *,
    model: str = "coach-daily-week-stub",
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Tu bude reálny daily-week prompt (7 dní).

    Zatiaľ STUB: vytvorí jednoduchý týždeň so 4 behmi + 2x sila.
    """
    week = payload.get("week") or {}
    week_index = int(week.get("week_index") or 1)
    week_start = week.get("week_start")
    week_end = week.get("week_end")

    if not week_start:
        # fallback: dnes → +6 dní
        today = datetime.utcnow().date()
        week_start = today.isoformat()
        week_end = (today.replace() + datetime.timedelta(days=6)).isoformat()

    # pre jednoduchosť – 7 dní za sebou z week_start
    start_d = service_parse_iso_date(week_start)
    days: List[Dict[str, Any]] = []

    for offset in range(7):
        d = (start_d + datetime.timedelta(days=offset)).isoformat()

        # veľmi jednoduchý pattern len na testovanie UI
        if offset in (0, 3):  # pondelok/štvrtok – sila
            sessions = [
                {
                    "sport": "strength",
                    "title": "Full-body strength",
                    "session_type": "strength_full_body",
                    "duration_min": 45,
                    "intensity": "moderate",
                    "structure": None,
                    "notes": None,
                    "tags": ["key"],
                }
            ]
        elif offset == 5:  # sobota – long run
            sessions = [
                {
                    "sport": "run",
                    "title": "Long run",
                    "session_type": "run_long_z2",
                    "duration_min": 60,
                    "intensity": "low",
                    "hr_zone_label": "Z2",
                    "target_hr_bpm_range": None,
                    "structure": None,
                    "notes": None,
                    "tags": ["key", "long"],
                }
            ]
        elif offset == 2:  # streda – intervaly
            sessions = [
                {
                    "sport": "run",
                    "title": "Threshold workout",
                    "session_type": "run_threshold",
                    "duration_min": 40,
                    "intensity": "high",
                    "hr_zone_label": "Z4",
                    "target_hr_bpm_range": None,
                    "structure": None,
                    "notes": None,
                    "tags": ["key", "hard"],
                }
            ]
        else:  # easy beh / rest
            sessions = [
                {
                    "sport": "run",
                    "title": "Easy run",
                    "session_type": "run_easy",
                    "duration_min": 30,
                    "intensity": "low",
                    "hr_zone_label": "Z2",
                    "target_hr_bpm_range": None,
                    "structure": None,
                    "notes": None,
                    "tags": [],
                }
            ]

        days.append(
            {
                "day": d,
                "notes": None,
                "sessions": sessions,
            }
        )

    daily_plan = {
        "schema_version": 1,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "model": model,
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "week_summary": None,
        "days": days,
    }

    if debug:
        print("[COACH-DAILY-WEEK] stub daily_plan:", daily_plan)

    return daily_plan


# ───────────────────────────── mapovanie do DB ─────────────────────────────


def daily_week_to_db_rows(
    user_id: int,
    plan_id: str,
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Premení CoachDailyWeekPlan na riadky pre coach_plan_daily.
    """
    rows: List[Dict[str, Any]] = []
    days = daily_plan.get("days") or []

    for d in days:
        day_str = str(d.get("day"))
        sessions = d.get("sessions") or []
        for idx, sess in enumerate(sessions):
            sport = service_canonical_sport(sess.get("sport"))
            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_str,
                "sport": sport,
                "title": sess.get("title"),
                "duration_min": sess.get("duration_min"),
                "intensity": sess.get("intensity"),
                "zone_text": service_hr_zone_text(sess),
                "structure": sess.get("structure"),
                "notes": sess.get("notes"),
                "source": "ai",  # alebo "ai_weekly"
                "plan_id": plan_id,
                "session_type": sess.get("session_type"),
                "session_index": idx,
                "payload": sess,
                "activity_id": None,
            }
            rows.append(row)

    return rows