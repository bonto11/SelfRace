# Services/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import date

from Configs.config import DEFAULT_MODEL
from Services.coach_athlete_state import build_input_from_db
from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_weekly import db_get_week_row_for_plan
from Routes_DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_clear_daily_for_user_week,
    db_list_daily_for_user_horizon,
)
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_AI.generate_plan_daily import generate_daily_week_json
from Services.coach_strength_mapper import (
    enrich_daily_plan_with_strength_exercises,
)
from Services.coach_external_events import service_list_external_events_window


def _build_daily_rows_from_ai(
    user_id: int,
    plan_id: Optional[str],
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Preklopí AI výstup (daily_plan JSON – už po obohatení strength mapperom)
    do rows pre coach_plan_daily.
    """
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []

    for day in days:
        date_str = day.get("date")
        sessions = day.get("sessions") or []
        if not date_str or not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict):
                continue

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str,
                "sport": s.get("sport") or "other",
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "zone_text": s.get("zone_text"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": "ai_daily_v1",
                "plan_id": plan_id,
                "session_type": s.get("session_type"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            }
            rows.append(row)

    return rows


def _flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    build_input_from_db dnes vracia:
      "prefs": { "value": { ... skutočné prefs ... } } alebo už čistý dict.
    Chceme pre AI čistý dict bez 'value' obalu.
    """
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        return raw["value"]
    return raw if isinstance(raw, dict) else {}


def _extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str] = None,
    overwrite: bool = True,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Generovanie DAILY plánu pre konkrétny týždeň + zápis do DB.

    - z coach_athlete_state (build_input_from_db) vezme prefs, recent_load, zones, thresholds
    - prefs flatten-ujeme (odstránime .value obal)
    - z weekly tabuľky si vytiahne week_start/week_end/focus/goal...
    - pre daný týždeň si vygeneruje external_events (výskyty v [week_start, week_end])
    - zavolá AI, výstup obohatí strength mapperom a uloží do coach_plan_daily
    """
    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    # 0) vyrieš plan_id – ak z FE nedošlo, skús aktívny / posledný plan z meta
    plan_id_effective: Optional[str] = plan_id
    if not plan_id_effective:
        meta = db_get_active_plan_meta_for_user(
            user_id
        ) or db_get_latest_plan_meta_for_user(user_id)
        if meta and isinstance(meta.get("plan_id"), str):
            plan_id_effective = meta["plan_id"]

    # 1) vstup z analyze (rovnaké ako weekly)
    analyze_input = build_input_from_db(user_id)

    # prefs + targets pre AI
    prefs_ai = _flatten_prefs_for_ai(analyze_input)
    targets_ai = _extract_targets_from_prefs(prefs_ai)

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

    # 2) weekly meta – ak máme plan_id, skúsime nájsť riadok v coach_plan_weekly
    week_row: Optional[Dict[str, Any]] = None
    if plan_id_effective:
        week_row = db_get_week_row_for_plan(
            user_id=user_id,
            plan_id=plan_id_effective,
            week_index=week_index,
        )

    week_meta: Dict[str, Any] = {
        "week_index": week_index,
        "week_start": week_row.get("week_start") if week_row else None,
        "week_end": week_row.get("week_end") if week_row else None,
        "goal": week_row.get("goal") if week_row else None,
        "focus": week_row.get("focus") if week_row else None,
        "load_phase": week_row.get("load_phase") if week_row else None,
        "planned_km": week_row.get("planned_km") if week_row else None,
        "planned_minutes": week_row.get("planned_minutes") if week_row else None,
    }

    # 3) EXTERNAL EVENTS – výskyty len pre tento týždeň
    external_block: Optional[Dict[str, Any]] = None
    if week_meta["week_start"] and week_meta["week_end"]:
        try:
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=week_meta["week_start"],
                to_iso=week_meta["week_end"],
            )
            external_block = {
                "window": {
                    "from": week_meta["week_start"],
                    "to": week_meta["week_end"],
                    "events": ext_window.get("events") or [],
                }
            }
        except Exception:
            external_block = None

    # 4) state pre AI (z coach_athlete_state tabuľky – najnovší version=1)
    state_row = db_get_latest_state_for_user(user_id=user_id, version=1)
    athlete_state_json = (state_row or {}).get("state_json") or None

    # 5) context pre AI – už zjednodušený
    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "week_index": week_index,
        "plan_id": plan_id_effective,
        "overwrite": overwrite,
        "week": week_meta,
        "prefs": prefs_ai,
        "targets": targets_ai,
        "athlete_state": athlete_state_json,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
    }
    if external_block is not None:
        context_payload["external_events"] = external_block

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    # 6) AI CALL
    daily_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )

    if not isinstance(daily_plan, dict):
        daily_plan = {}

    # priraď plan_id do daily_planu, aby ho videl strength history
    plan_id_out = plan_id_effective
    if plan_id_out:
        daily_plan["plan_id"] = plan_id_out

    # 6b) STRENGTH MAPPER – doplní konkrétne cviky podľa DB
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
    )

    # 7) zápis do DB (coach_plan_daily)
    deleted_rows = 0
    if overwrite and plan_id_out and week_meta["week_start"] and week_meta["week_end"]:
        deleted_rows = db_clear_daily_for_user_week(
            user_id=user_id,
            plan_id=plan_id_out,
            week_start=week_meta["week_start"],
            week_end=week_meta["week_end"],
        )

    rows_to_insert: List[Dict[str, Any]] = _build_daily_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id_out,
        daily_plan=daily_plan,
    )

    inserted_rows = db_insert_daily_rows(rows_to_insert) if rows_to_insert else 0

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,  # už obohatený o konkrétne cviky
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

    return resp


def service_get_daily_overview(
    user_id: int,
    horizon_days: int = 7,
) -> Dict[str, Any]:
    """
    Vráti jednoduchý DAILY prehľad pre najbližších N dní.
    Berie len sessions pre aktívny plán (ak existuje),
    inak fallback na posledný plán a nakoniec na všetko.
    """
    if horizon_days <= 0:
        horizon_days = 7

    # zisti aktívny / posledný plan_id
    meta = db_get_active_plan_meta_for_user(
        user_id
    ) or db_get_latest_plan_meta_for_user(user_id)
    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            horizon_days=horizon_days,
            plan_id=plan_id,
        )
        or []
    )

    # zgrupujeme podľa dátumu
    by_date: Dict[str, List[Dict[str, Any]]] = {}

    for r in rows:
        d = r.get("plan_date")
        if not d:
            continue
        if d not in by_date:
            by_date[d] = []
        by_date[d].append(r)

    days_out: List[Dict[str, Any]] = []

    for date_str, sessions in sorted(by_date.items(), key=lambda kv: kv[0]):
        sessions_out: List[Dict[str, Any]] = []
        for s in sorted(sessions, key=lambda x: int(x.get("session_index") or 0)):
            sessions_out.append(
                {
                    "sport": s.get("sport") or "other",
                    "title": s.get("title"),
                    "duration_min": s.get("duration_min"),
                    "intensity": s.get("intensity"),
                    "zone_text": s.get("zone_text"),
                    "notes": s.get("notes"),
                    "session_type": s.get("session_type"),
                }
            )

        days_out.append(
            {
                "date": date_str,
                "sessions": sessions_out,
            }
        )

    return {
        "horizon_days": horizon_days,
        "days": days_out,
    }