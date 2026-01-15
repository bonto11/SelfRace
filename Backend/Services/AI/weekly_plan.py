# Services/AI/weekly_plan.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from uuid import uuid4

from Configs.config import DEFAULT_MODEL


from Services.AI.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)

from Services.AI.weekly_plan_builders import (
    build_weekly_context_from_db,
    extract_weeks_payload,
    build_weekly_rows_from_ai,
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

from Services.users import require_jwt

def service_generate_weekly_plan(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service pre weekly plán.
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    plan_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    if not service and is_user_over_token_quota(
        user_id,
        user_jwt=jwt,
        service=service,
    ):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "weekly_plan": None,
            "plan_id": None,
            "state_id": None,
            "model": plan_model,
            "overwrite": overwrite,
            "weeks": weeks,
            "error": {
                "code": "ai_quota_exceeded",
                "message": (
                    "Mesačný limit AI plánov bol vyčerpaný. "
                    "Skús to znova na začiatku ďalšieho mesiaca alebo ma kontaktuj."
                ),
                "used_tokens_this_month": used,
            },
        }

    ctx = build_weekly_context_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
        overwrite=overwrite,
        state_id=state_id,
        weeks=weeks,
    )

    context_payload = ctx["context_payload"]
    state_bundle = ctx["state_bundle"]
    horizon_weeks = ctx["horizon_weeks"]

    used_state_id = state_bundle["state_id"]

    # NOTE(review): do LLM payloadu posielaš `context_payload["user_id"]`
    # (aj `context_payload["analyze_input"]` typicky obsahuje interné ids).
    # Ak chceš, aby LLM nemalo user_id, sprav anonymizáciu v builderi (nie tu),
    # inak si to LLM vie “niesť” v trace/debug.
    # NOTE(review): `analyze_input` môže byť objemné; ak sa ti rozbíja kontext okno,
    # tak ho v `build_weekly_context_from_db` minifikuj (ponechaj len to čo weekly prompt reálne používa).

    weekly_plan, trace = generate_weekly_plan_json(
        context_payload=context_payload,
        model=plan_model,
        debug_raw=debug,
    )

    usage = extract_usage_from_trace(trace)
    billing_result: Optional[Dict[str, Any]] = None
    if usage:
        if plan_model:
            usage["model"] = plan_model
        try:
            billing_result = log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.generate_weekly_plan",
                source="service" if service else "user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "state_id": used_state_id,
                    "requested_weeks": weeks,
                    "horizon_weeks": horizon_weeks,
                },
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] weekly_plan billing error:", repr(e))

    if isinstance(weekly_plan, dict) and weekly_plan.get("plan_id"):
        plan_id = str(weekly_plan["plan_id"])
    else:
        plan_id = str(uuid4())

    deleted_rows = 0
    archived_meta = 0
    if overwrite:
        archived_meta = db_archive_user_plans(
            user_id,
            user_jwt=jwt,
            service=service,
        )

        latest_plan_id = db_get_latest_plan_id_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        )
        if latest_plan_id:
            deleted_rows = db_clear_weekly_for_user_plan(
                user_id=user_id,
                plan_id=latest_plan_id,
                user_jwt=jwt,
                service=service,
            )

    weeks_list = extract_weeks_payload(weekly_plan)
    rows: List[Dict[str, Any]] = build_weekly_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id,
        weeks_list=weeks_list,
    )

    inserted_rows = db_insert_weekly_rows(
        rows,
        user_jwt=jwt,
        service=service,
    )

    plan_meta_dict = (weekly_plan.get("plan_meta") if isinstance(weekly_plan, dict) else {}) or {}

    # NOTE(review): print v produkcii (obsahuje meta z LLM) – zváž znížiť na debug-only
    print("[DB-COACH-WEEKLY] plan_meta_dict:", plan_meta_dict)

    start_date: Optional[str] = plan_meta_dict.get("start_date") or None
    end_date: Optional[str] = plan_meta_dict.get("end_date") or None

    if not start_date and weeks_list:
        start_date = weeks_list[0].get("week_start") or None
    if not end_date and weeks_list:
        last_week = weeks_list[-1]
        end_date = last_week.get("week_end") or last_week.get("week_start") or None

    main_sport = plan_meta_dict.get("main_sport")
    goal_kind = plan_meta_dict.get("goal_kind")

    # NOTE(review): print v produkcii
    print("[DB-COACH-WEEKLY] plan_id:", plan_id)

    meta_row = db_insert_plan_meta_generated(
        user_id=user_id,
        user_jwt=jwt,
        plan_id=plan_id,
        base_state_id=used_state_id if isinstance(used_state_id, int) else None,
        weeks_total=len(weeks_list) or horizon_weeks,
        start_date=start_date,
        end_date=end_date,
        main_sport=main_sport,
        goal_kind=goal_kind,
        source="ai_weekly_v1",
        service=service,
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
        resp["ai_usage"] = usage
        resp["billing"] = billing_result

    return resp

def service_get_latest_weekly_plan(
    user_id: int,
    *,
    user_jwt: str,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší weekly plán pre daného usera (vrátane listu týždňov).

    Toto nechávame čisto RLS/FE (žiadny service režim).
    """
    jwt = require_jwt(user_jwt)

    # 1) Skús najnovší plan_id z coach_plan_meta
    meta = db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
        service=False,
    )
    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    # fallback na weekly tabuľku (cez RLS)
    if not plan_id:
        plan_id = db_get_latest_plan_id_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=False,
        )
        if not plan_id:
            return None

    rows = db_get_weekly_for_user_plan(
        user_id=user_id,
        plan_id=plan_id,
        user_jwt=jwt,
        service=False,
    )
    if not rows:
        return None

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