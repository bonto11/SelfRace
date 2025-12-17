# Services/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from uuid import uuid4

from Configs.config import DEFAULT_MODEL, COACH_PLAN_MIN_WEEKS, COACH_PLAN_DEAFULT_WEEKS, COACH_PLAN_MAX_WEEKS
from Services.coach_athlete_state import build_input_from_db
from Routes_DB.coach_athlete_state import (
    db_get_state_by_id,
    db_get_latest_state_for_user,
)
from Routes_AI.generate_plan_weekly import generate_weekly_plan_json
from Routes_DB.coach_plan_weekly import (
    db_insert_weekly_rows,
    db_clear_weekly_for_user_plan,
    db_get_latest_plan_id_for_user,
    db_get_weekly_for_user_plan,
)
from Routes_DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
    db_archive_user_plans,
    db_get_latest_plan_meta_for_user,
)

from Services.coach_external_events import (service_build_external_events_block_for_analysis, service_list_external_events_window)

def _load_athlete_state_for_plan(
    user_id: int,
    state_id: Optional[int],
) -> Dict[str, Any]:
    """
    Nájde vhodný coach_athlete_state pre plánovanie.

    Priority:
      1) explicitný state_id (ak existuje),
      2) najnovší stav pre usera (version=1).

    Keď nič nenájdeme → ValueError (FE dostane 400).
    """
    row: Optional[Dict[str, Any]] = None

    if state_id is not None:
        row = db_get_state_by_id(state_id)

    if not row:
        row = db_get_latest_state_for_user(user_id=user_id, version=1)

    if not row:
        raise ValueError(
            "No athlete state found for this user. "
            "Run /coach/athlete/analyze first or pass a valid state_id."
        )

    state_json = row.get("state_json")
    if not isinstance(state_json, dict):
        raise ValueError("Stored athlete state has invalid format (state_json).")

    # meta + samotný state
    return {
        "state_id": row.get("id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
    }


def _extract_weeks_payload(weekly_plan: Any) -> List[Dict[str, Any]]:
    """
    Z AI výstupu vytiahne list týždňov.
    Podporujeme:
      - {"weeks": [ ... ]}
      - [ { ... }, { ... } ]
    """
    if isinstance(weekly_plan, dict):
        weeks = weekly_plan.get("weeks")
        if isinstance(weeks, list):
            return weeks
        # fallback: ak by AI poslalo rovno list v "plan"
        if isinstance(weekly_plan.get("plan"), list):
            return weekly_plan["plan"]
        return []
    if isinstance(weekly_plan, list):
        return weekly_plan
    return []


def service_generate_weekly_plan(
    user_id: int,
    *,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service pre weekly plán.

    - načíta CoachAnalyzeInput z DB (build_input_from_db)
    - nájde vhodný coach_athlete_state (podľa state_id alebo latest)
    - poskladá context_payload pre AI
    - zavolá OpenAI weekly generátor
    - uloží výsledok do coach_plan_weekly
    - založí coach_plan_meta so status='generated'
    - vráti { weekly_plan, plan_id, state_id, ... }
    """
    # 1) vstup pre AI (rovnaký ako pre analyze)
    analyze_input = build_input_from_db(user_id)

    # PREFS – flatten (kvôli tomu, že v prefs môže byť 'value' obal)
    raw_prefs = analyze_input.get("prefs") or {}
    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
        raw_prefs["value"], dict
    ):
        prefs_ai = raw_prefs["value"]
    elif isinstance(raw_prefs, dict):
        prefs_ai = raw_prefs
    else:
        prefs_ai = {}

    # EXTERNAL EVENTS – blok z analyze_input (horizont okolo dneška)
    external_events_block = analyze_input.get("external_events")

    # 2) stav atlétu z analyze
    state_bundle = _load_athlete_state_for_plan(user_id=user_id, state_id=state_id)

    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    # koľko týždňov – preferuj z payloadu, inak z prefs, fallback 6
    raw_weeks = int(weeks or prefs_ai.get("weeks") or COACH_PLAN_DEAFULT_WEEKS)
    horizon_weeks = max(COACH_PLAN_MIN_WEEKS,min(raw_weeks, COACH_PLAN_MAX_WEEKS))

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "weeks": horizon_weeks,
        "overwrite": overwrite,
        # pre prompt:
        "prefs": prefs_ai,
        "analyze_input": analyze_input,
        "athlete_state": athlete_state,
        "athlete_state_meta": {
            "state_id": used_state_id,
            "model": state_bundle.get("model"),
            "version": state_bundle.get("version"),
            "created_at": state_bundle.get("created_at"),
        },
    }

    if external_events_block is not None:
        context_payload["external_events"] = external_events_block

    plan_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    weekly_plan, trace = generate_weekly_plan_json(
        context_payload=context_payload,
        model=plan_model,
        debug_raw=debug,
    )

    # 3) vyber plan_id (z AI alebo nové)
    if isinstance(weekly_plan, dict) and weekly_plan.get("plan_id"):
        plan_id = str(weekly_plan["plan_id"])
    else:
        plan_id = str(uuid4())

    # 4) ak overwrite=True, archivuj staré meta a vymaž posledný weekly plán
    deleted_rows = 0
    archived_meta = 0
    if overwrite:
        # meta – archived
        archived_meta = db_archive_user_plans(user_id)

        # starý weekly plán – podľa doterajšej logiky
        latest_plan_id = db_get_latest_plan_id_for_user(user_id=user_id)
        if latest_plan_id:
            deleted_rows = db_clear_weekly_for_user_plan(
                user_id=user_id,
                plan_id=latest_plan_id,
            )

    # 5) priprav INSERT rows
    weeks_list = _extract_weeks_payload(weekly_plan)
    rows: List[Dict[str, Any]] = []

    for idx, w in enumerate(weeks_list, start=1):
        if not isinstance(w, dict):
            continue

        week_index = int(w.get("week_index") or idx)

        row: Dict[str, Any] = {
            "user_id": user_id,
            "plan_id": plan_id,
            "week_index": week_index,
            "week_start": w.get("week_start"),  # "YYYY-MM-DD"
            "week_end": w.get("week_end"),
            "goal": w.get("goal"),
            "focus": w.get("focus"),
            "load_phase": w.get("load_phase"),
            "planned_km": w.get("planned_km"),
            "planned_minutes": w.get("planned_minutes"),
            "completed_km": None,
            "completed_minutes": None,
            "notes": w.get("notes"),
            "raw_json": w,
        }

        rows.append(row)

    inserted_rows = db_insert_weekly_rows(rows)

    # 6) založ meta záznam (status='generated')
    plan_meta_dict = (
        weekly_plan.get("plan_meta") if isinstance(weekly_plan, dict) else {}
    ) or {}

    print("[DB-COACH-WEEKLY] plan_meta_dict:", plan_meta_dict)

    # start/end z meta alebo z prvého/posledného týždňa
    start_date: Optional[str] = plan_meta_dict.get("start_date") or None
    end_date: Optional[str] = plan_meta_dict.get("end_date") or None

    if not start_date and weeks_list:
        start_date = weeks_list[0].get("week_start") or None
    if not end_date and weeks_list:
        last_week = weeks_list[-1]
        end_date = last_week.get("week_end") or last_week.get("week_start") or None

    main_sport = plan_meta_dict.get("main_sport")
    goal_kind = plan_meta_dict.get("goal_kind")

    print("[DB-COACH-WEEKLY] plan_id:", plan_id)
    meta_row = db_insert_plan_meta_generated(
        user_id=user_id,
        plan_id=plan_id,
        base_state_id=used_state_id if isinstance(used_state_id, int) else None,
        weeks_total=len(weeks_list) or horizon_weeks,
        start_date=start_date,
        end_date=end_date,
        main_sport=main_sport,
        goal_kind=goal_kind,
        source="ai_weekly_v1",
    )

    resp: Dict[str, Any] = {
        "weekly_plan": weekly_plan,
        "plan_id": plan_id,
        "state_id": used_state_id,
        "model": plan_model,
        "overwrite": overwrite,
        "weeks": horizon_weeks,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "archived_meta": archived_meta,
    }
    if meta_row is not None:
        resp["plan_meta"] = meta_row
    if debug and trace is not None:
        resp["debug"] = trace

    return resp
def service_get_latest_weekly_plan(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší weekly plán pre daného usera (vrátane listu týždňov).

    Štruktúra:
      {
        "plan_id": "...",
        "weeks": [ ... ]
      }
    Alebo None, ak user nemá žiadny plán.
    """
    # 1) Skús najnovší plan_id z coach_plan_meta
    meta = db_get_latest_plan_meta_for_user(user_id=user_id)
    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    # fallback na starý mechanizmus (pre legacy dáta)
    if not plan_id:
        plan_id = db_get_latest_plan_id_for_user(user_id=user_id)
        if not plan_id:
            return None

    rows = db_get_weekly_for_user_plan(user_id=user_id, plan_id=plan_id)
    if not rows:
        return None

    # zoradíme podľa week_index
    weeks: List[Dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: int(x.get("week_index") or 0)):
        weeks.append(
            {
                "week_index": int(r.get("week_index") or 0),
                "week_start": r.get("week_start"),
                "week_end": r.get("week_end"),
                "goal": r.get("goal"),
                "focus": r.get("focus"),
                "load_phase": r.get("load_phase"),
                "planned_km": r.get("planned_km"),
                "planned_minutes": r.get("planned_minutes"),
                "completed_km": r.get("completed_km"),
                "completed_minutes": r.get("completed_minutes"),
                "notes": r.get("notes"),
                "raw_json": r.get("raw_json"),
            }
        )

    return {
        "plan_id": plan_id,
        "weeks": weeks,
    }