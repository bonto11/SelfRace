# Services/AI/daily_plan.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import date

from Configs.config import DEFAULT_MODEL, COACH_PLAN_SCAN_HORIZON_DAYS
from Services.AI.daily_builders import (
    build_daily_rows_from_ai,
    build_daily_context_from_db,
)
from Services.AI.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)

from Routes_DB.coach_plan_weekly import (
    db_get_weekly_for_user_plan,
)
from Routes_DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_clear_daily_for_user_week,
    db_list_daily_for_user_horizon,
    db_get_planned_range_rows,
)
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_AI.generate_plan_daily import generate_daily_week_json
from Services.coach_strength_mapper import enrich_daily_plan_with_strength_exercises
from Services.users import require_jwt


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
    """
    Generovanie DAILY plánu pre konkrétny týždeň + zápis do DB.

    Režimy:
      - FE / RLS:    service=False, user_jwt povinný → require_jwt → RLS klient.
      - service:     service=True, user_jwt typicky None → DB vrstvy idú cez service klientov.
    """
    if service:
        # service klient – DB si z parametra `service=True` vyberie správneho klienta
        jwt = user_jwt  # typicky None
    else:
        jwt = require_jwt(user_jwt)

    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    # 0) QUOTA CHECK – obmedzenie pre user-trigger volania (FE / RLS)
    if not service and is_user_over_token_quota(
        user_id,
        user_jwt=jwt,
        service=service,
    ):
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

    # 1) builder – všetko z DB do contextu pre AI
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

    # 2) AI CALL
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

    # 3) BILLING – usage za daily plán
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
                billed_via="internal",   # zatiaľ len log, bez wallet
                charge_wallet=False,
                meta={
                    "week_index": week_index,
                    "plan_id": plan_id_out,
                },
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] daily_plan billing error:", repr(e))

    # 4) STRENGTH MAPPER – doplní konkrétne cviky podľa DB
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

    # 5) zápis do DB (coach_plan_daily)
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
        db_insert_daily_rows(
            rows_to_insert,
            user_jwt=jwt,
            service=service,
        )
        if rows_to_insert
        else 0
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


def service_get_daily_overview(
    user_id: int,
    horizon_days: int = 7,
    *,
    user_jwt: str,
) -> Dict[str, Any]:
    """
    Vráti jednoduchý DAILY prehľad pre najbližších N dní (RLS).

    Toto ostáva čisto RLS (FE volanie), service režim tu nepotrebujeme.
    """
    jwt = require_jwt(user_jwt)

    if horizon_days <= 0:
        horizon_days = 7

    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    ) or db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    )

    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

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
        by_date.setdefault(d, []).append(r)

    days_out: List[Dict[str, Any]] = []

    for date_str, sessions in sorted(by_date.items(), key=lambda kv: kv[0]):
        sessions_out: List[Dict[str, Any]] = []

        for s in sorted(sessions, key=lambda x: int(x.get("session_index") or 0)):
            payload = s.get("payload") or {}
            structure = s.get("structure") or payload.get("structure")

            if structure is None:
                strength_ex = s.get("strength_exercises") or payload.get(
                    "strength_exercises"
                )
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


def service_auto_extend_daily_plan(
    user_id: int,
    *,
    min_horizon_days: int = 6,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Postará sa o to, aby aktívny (alebo posledný) plán mal vždy
    aspoň `min_horizon_days` naplánovaných dní v coach_plan_daily.

    Režimy:
      - FE/RLS: service=False, user_jwt povinný.
      - service: service=True, user_jwt typicky None, DB ide cez service klientov.
    """
    if service:
        jwt = user_jwt  # typicky None
    else:
        jwt = require_jwt(user_jwt)

    if min_horizon_days <= 0:
        min_horizon_days = 6

    today = date.today()

    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    ) or db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    if not plan_id:
        return {
            "changed": False,
            "reason": "no_plan",
        }

    # existujúce daily rows (veľké okno dopredu)
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
        return {
            "changed": False,
            "reason": "no_daily_rows",
        }

    last_date_str = max(
        str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
    )
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

    weekly_sorted = sorted(
        weekly_rows,
        key=lambda w: int(w.get("week_index") or 0),
    )

    current_week_index: Optional[int] = None
    for w in weekly_sorted:
        ws_raw = w.get("week_start")
        we_raw = w.get("week_end") or ws_raw

        if not isinstance(ws_raw, str) or not isinstance(we_raw, str):
            continue

        try:
            ws = date.fromisoformat(ws_raw)
            we = date.fromisoformat(we_raw)
        except ValueError:
            continue

        if ws <= last_date <= we:
            current_week_index = int(w.get("week_index") or 0)
            break

    if current_week_index is None:
        for w in weekly_sorted:
            ws_raw = w.get("week_start")
            if not isinstance(ws_raw, str):
                continue
            try:
                ws = date.fromisoformat(ws_raw)
            except ValueError:
                continue

            if ws <= last_date:
                current_week_index = int(w.get("week_index") or 0)

    if current_week_index is None:
        return {
            "changed": False,
            "reason": "cannot_determine_current_week",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    future_weeks = [
        w for w in weekly_sorted if int(w.get("week_index") or 0) > current_week_index
    ]
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

        gen = service_generate_daily_week(
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

        current_last_str = max(
            str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
        )
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