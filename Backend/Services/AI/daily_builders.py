# Services/AI/daily_builders.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Services.AI.athlete_state_input_builder import build_input_from_db
from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_weekly import db_get_week_row_for_plan
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Services.coach_external_events import service_list_external_events_window


def build_daily_rows_from_ai(
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


def flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    build_input_from_db vracia:
      "prefs": { "value": { ... } } alebo už čistý dict.
    Chceme pre AI čistý dict bez 'value' obalu.
    """
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        return raw["value"]
    return raw if isinstance(raw, dict) else {}


def extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Vytiahne prefs.targets ako dict.
    """
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def build_daily_context_from_db(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str],
    overwrite: bool,
    user_jwt: Optional[str],
    service: bool,
) -> Dict[str, Any]:
    """
    Poskladá context_payload pre DAILY plán z DB.

    Volajúci rieši:
      - require_jwt (v RLS režime),
      - quota/billing.
    """
    jwt = user_jwt

    # 1) vyrieš plan_id – aktívny / posledný meta záznam
    plan_id_effective: Optional[str] = plan_id
    if not plan_id_effective:
        meta = db_get_active_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        ) or db_get_latest_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        )
        if meta and isinstance(meta.get("plan_id"), str):
            plan_id_effective = meta["plan_id"]

    # 2) vstup z analyze (rovnaké ako weekly / athlete_state)
    analyze_input = build_input_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # prefs + targets pre AI
    prefs_ai = flatten_prefs_for_ai(analyze_input)
    targets_ai = extract_targets_from_prefs(prefs_ai)

    weekly_template: Dict[str, Any] = {}
    if isinstance(prefs_ai, dict):
        wt = prefs_ai.get("weekly_template")
        if isinstance(wt, dict):
            weekly_template = wt

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

    # 3) weekly meta – ak máme plan_id, nájdeme konkrétny týždeň
    week_row: Optional[Dict[str, Any]] = None
    if plan_id_effective:
        week_row = db_get_week_row_for_plan(
            user_id=user_id,
            plan_id=plan_id_effective,
            week_index=week_index,
            user_jwt=jwt,
            service=service,
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

    # 4) EXTERNAL EVENTS – výskyty len pre tento týždeň
    external_block: Optional[Dict[str, Any]] = None
    if week_meta["week_start"] and week_meta["week_end"]:
        try:
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=week_meta["week_start"],
                to_iso=week_meta["week_end"],
                user_jwt=jwt,
                service=service,
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

    # 5) state pre AI (coach_athlete_state)
    state_row = db_get_latest_state_for_user(
        user_id=user_id,
        version=1,
        user_jwt=jwt,
        service=service,
    )
    athlete_state_json = (state_row or {}).get("state_json") or None

    # 6) context pre AI
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
        "weekly_template": weekly_template,
    }
    if external_block is not None:
        context_payload["external_events"] = external_block

    return {
        "context_payload": context_payload,
        "plan_id_effective": plan_id_effective,
        "week_meta": week_meta,
        "state_row": state_row,
        "prefs_ai": prefs_ai,
        "targets_ai": targets_ai,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
        "weekly_template": weekly_template,
        "analyze_input": analyze_input,
    }