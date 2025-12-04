# Services/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Configs.config import DEFAULT_MODEL
from Services.coach_athlete_state import build_input_from_db
from Services.coach_plan_weekly import _load_athlete_state_for_plan
from Routes_DB.coach_plan_weekly import (
    db_get_week_row_for_plan,
    db_get_latest_plan_id_for_user,
)
from Routes_DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_clear_daily_for_user_week,
)
from Routes_AI.generate_plan_daily import generate_daily_week_json


def _build_week_context(weekly_row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Poskladá week objekt pre AI z DB riadku coach_plan_weekly.

    Preferuje raw_json (ak existuje a je dict), ale doplní
    / prepíše kľúčové polia z DB (week_index, week_start, ...).
    """
    week: Dict[str, Any] = {}

    raw = weekly_row.get("raw_json")
    if isinstance(raw, dict):
        week = dict(raw)  # shallow copy
    else:
        week = {}

    # povinné polia z DB
    for key in [
        "week_index",
        "week_start",
        "week_end",
        "goal",
        "focus",
        "load_phase",
        "planned_km",
        "planned_minutes",
        "notes",
    ]:
        if key in weekly_row and weekly_row[key] is not None:
            week[key] = weekly_row[key]

    # fallbacky
    if "week_index" not in week:
        week["week_index"] = weekly_row.get("week_index")
    if "week_start" not in week:
        week["week_start"] = weekly_row.get("week_start")
    if "week_end" not in week:
        week["week_end"] = weekly_row.get("week_end")

    return week


def _extract_days_payload(daily_plan: Any) -> List[Dict[str, Any]]:
    """
    Z AI výstupu vytiahne list dní.
    Podporujeme:
      - {"days": [ ... ]}
      - [ { date: ..., sessions: [...] }, ... ]
    """
    if isinstance(daily_plan, dict):
        days = daily_plan.get("days")
        if isinstance(days, list):
            return days
        # fallback: ak by AI poslalo rovno list v "plan"
        if isinstance(daily_plan.get("plan"), list):
            return daily_plan["plan"]
        return []
    if isinstance(daily_plan, list):
        return daily_plan
    return []


def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str] = None,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Generovanie DAILY plánu pre konkrétny týždeň + zápis do coach_plan_daily.

    - načíta analyze_input z DB (build_input_from_db)
    - nájde vhodný coach_athlete_state (rovnako ako weekly)
    - nájde weekly meta row (coach_plan_weekly) podľa plan_id + week_index
      - ak plan_id nie je zadaný → vezme latest plan_id pre usera
    - poskladá context_payload pre AI
    - zavolá Routes_AI.generate_plan_daily.generate_daily_week_json
    - podľa potreby vymaže staré daily sessions v DB (overwrite)
    - uloží nové daily sessions do coach_plan_daily
    - vráti { daily_plan, plan_id, week_index, inserted_rows, deleted_rows, ... }
    """
    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    # 1) resolve plan_id (ak nie je zadaný → najnovší weekly plán)
    effective_plan_id = plan_id
    if not effective_plan_id:
        effective_plan_id = db_get_latest_plan_id_for_user(user_id=user_id)
    if not effective_plan_id:
        raise ValueError(
            "No weekly plan found for this user. "
            "Generate weekly plan first before calling daily generator."
        )

    # 2) načítaj weekly row pre daný week_index
    weekly_row = db_get_week_row_for_plan(
        user_id=user_id,
        plan_id=effective_plan_id,
        week_index=week_index,
    )
    if not weekly_row:
        raise ValueError(
            f"No weekly row found for plan_id={effective_plan_id}, week_index={week_index}."
        )

    week_ctx = _build_week_context(weekly_row)
    week_start = str(week_ctx.get("week_start"))
    week_end = str(week_ctx.get("week_end"))

    # 3) analyze_input (prefs + zones + thresholds + recent history)
    analyze_input = build_input_from_db(user_id)
    prefs = analyze_input.get("prefs") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}
    recent_load = (
        analyze_input.get("recent_load")
        or analyze_input.get("history")
        or analyze_input.get("activities")
        or {}
    )

    # 4) stav atlétu z analyze (re-use helper z weekly service)
    state_bundle = _load_athlete_state_for_plan(
        user_id=user_id,
        state_id=state_id,
    )
    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    # 5) context_payload pre AI daily
    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "plan_id": effective_plan_id,
        "week": week_ctx,
        "prefs": prefs,
        "zones": zones,
        "thresholds": thresholds,
        "recent_load": recent_load,
        "athlete_state": athlete_state,
        "athlete_state_meta": {
            "state_id": used_state_id,
            "model": state_bundle.get("model"),
            "version": state_bundle.get("version"),
            "created_at": state_bundle.get("created_at"),
        },
        # pre úplnosť tam môžeš nechať aj celé analyze_input,
        # ak ho chceš mať v prompt-e
        "analyze_input": analyze_input,
    }

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    # 6) AI call
    daily_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )

    # 7) vyčisti staré daily sessions, ak treba
    deleted_rows = 0
    if overwrite and week_start and week_end:
        deleted_rows = db_clear_daily_for_user_week(
            user_id=user_id,
            plan_id=effective_plan_id,
            week_start=week_start,
            week_end=week_end,
        )

    # 8) priprav insert rows z AI výstupu
    days_list = _extract_days_payload(daily_plan)
    rows: List[Dict[str, Any]] = []

    for day in days_list:
        if not isinstance(day, dict):
            continue
        date_str = day.get("date")
        if not date_str:
            continue

        sessions = day.get("sessions") or []
        if not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions, start=1):
            if not isinstance(s, dict):
                continue

            sport = s.get("sport") or "other"
            title = s.get("title") or "Tréning"

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_id": effective_plan_id,
                "plan_date": date_str,
                "sport": sport,
                "title": title,
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "zone_text": s.get("zone_text"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": s.get("source") or f"ai-daily:{daily_model}",
                "session_type": s.get("session_type"),
                "session_index": idx,
                "payload": s.get("payload"),
                "activity_id": None,
            }

            rows.append(row)

    inserted_rows = db_insert_daily_rows(rows)

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "plan_id": effective_plan_id,
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "state_id": used_state_id,
        "model": daily_model,
        "overwrite": overwrite,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
    }
    if debug and trace is not None:
        resp["debug"] = trace

    return resp