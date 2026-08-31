# Services/AI/weekly_plan/main.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import date as _date

from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)
from DB.activities_summary import db_get_activities_in_range_basic

from Services.AI.weekly_plan.builders import (
    build_weekly_context_from_db,
    extract_weeks_payload,
    build_weekly_rows_from_ai,
)
from Services.AI.weekly_plan.generate import generate_weekly_plan_json
from Services.coach_user_notes import service_consume_pending_ephemeral

from DB.coach_plan_weekly import (
    db_insert_weekly_rows,
    db_set_plan_meta_id_for_weekly_rows,
    db_clear_weekly_for_user_plan,
    db_delete_current_and_future_weekly_plans,
    db_get_weekly_for_user_plan,
    db_get_weekly_row_by_date,
    db_update_weekly_actual_stats,
)
from DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPER
# ============================================================

def _log_ai_usage(
    user_id: int,
    trace: Dict[str, Any],
    model: str,
    job_type: str,
    meta: Dict[str, Any],
    ctx: AuthCtx,
) -> None:
    """Zaloguje AI usage s provider a model z trace."""
    usage = extract_usage_from_trace(trace, model_fallback=model)
    if not usage:
        return
    try:
        log_ai_usage_for_user(
            user_id=user_id,
            usage=usage,
            job_type=job_type,
            source="user",
            billed_via="internal",
            charge_wallet=False,
            meta={
                "provider": trace.get("ok_provider"),
                "model": trace.get("ok_model"),
                **meta,
            },
            ctx=ctx,
        )
    except Exception as e:
        print(f"[AI_BILLING] {job_type} billing error: {repr(e)}")


# ============================================================
# GENERATE WEEKLY PLAN
# ============================================================

def service_generate_weekly_plan(
    user_id: int,
    *,
    ctx: AuthCtx,
    full_reset: bool = False,
    overwrite: bool = True,
    state_id: Optional[int] = None,
    weeks: Optional[int] = None,
    model: Optional[str] = None,
    override_start_date: Optional[str] = None,
    reason: Optional[str] = None,
    target_end_date: Optional[str] = None,
    plan_meta_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Hlavný service pre generovanie weekly meta-plánu.

    plan_meta_id: NOVÉ - ktorému konkrétnemu plánu (coach_plan_meta.id) tento
    replan patrí.
    - full_reset=True (prvotné generovanie z Prefs, plán ešte neaktívny):
      plan_meta_id sa ignoruje na vstupe - vždy vzniká NOVÝ meta záznam AŽ
      PO úspešnom vygenerovaní (lebo jeho start_date/end_date/weeks_total sa
      počíta z reálneho AI výstupu). Weekly riadky sa najprv vložia bez
      plan_meta_id a hneď potom sa im dopíše cez
      db_set_plan_meta_id_for_weekly_rows.
    - full_reset=False (replan existujúceho plánu): ak volajúci explicitne
      pošle plan_meta_id, použije sa presne ten. Ak nie, service si sám
      dohľadá aktívny/najnovší meta záznam usera (zachováva pôvodné
      správanie pre volania, ktoré ešte plan_meta_id neposielajú).

    FIX oproti predošlej verzii: predtým sa weekly riadky nijako
    nepriraďovali ku konkrétnemu plánu - viedlo to k tomu, že replan
    aktívneho plánu mohol omylom čítať/mazať/prepisovať dáta úplne iného
    (napr. nedokončeného draftu) plánu toho istého usera. Pozri root-cause
    analýzu v chate (plán 61 vs. draft 71/72/73/75).
    """
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI plánov bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    existing_meta: Optional[Dict[str, Any]] = None
    if full_reset:
        # 🌟 NOVÉ (defense-in-depth): FE už skrýva tlačidlo "Vygenerovať" keď
        # je plán aktívny (PlanLifecycleSection.tsx: `{!isPlanActive && ...}`),
        # ale backend to doteraz vôbec nekontroloval - priame API volanie
        # (alebo retry jobu) by full_reset prešlo aj s aktívnym plánom a
        # vytvorilo by sa nechcené súbežné dianie. Tu to teraz natvrdo
        # odmietneme.
        active_meta_guard = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
        if active_meta_guard:
            return {
                "ok": False,
                "code": "active_plan_exists",
                "message": "Máš už aktívny plán - najprv ho zruš alebo nechaj doviesť do konca, než vygeneruješ nový.",
            }
        # Prvotné generovanie - meta ešte neexistuje, vždy vznikne nový.
        plan_meta_id = None
    elif plan_meta_id is None:
        existing_meta = (
            db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
            or db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)
        )
        plan_meta_id = existing_meta.get("id") if existing_meta else None

    # Builder — zostaví context z DB (vrátane coach_notes), scoped na plan_meta_id
    context = build_weekly_context_from_db(
        user_id=user_id,
        ctx=ctx,
        state_id=state_id,
        weeks=weeks,
        plan_meta_id=plan_meta_id,
        full_reset=full_reset,
        target_end_date=target_end_date,
    )

    context_payload = context["context_payload"]
    state_bundle = context["state_bundle"]
    horizon_weeks = context["horizon_weeks"]
    used_state_id = state_bundle["state_id"]

    print(
        f"[WEEKLY-PLAN][user={user_id}] plan_meta_id={plan_meta_id!r} "
        f"target_end_date={target_end_date!r} weeks_param={weeks!r} "
        f"horizon_weeks={horizon_weeks} is_replan={context_payload.get('is_replan')} "
        f"week_boundaries="
        f"{[(wb.get('week_index'), wb.get('week_start'), wb.get('week_end')) for wb in (context_payload.get('week_boundaries') or [])]}"
    )

    if reason:
        context_payload["generate_reason"] = reason

    if override_start_date:
        if isinstance(context_payload.get("prefs"), dict):
            context_payload["prefs"]["plan_start_date"] = override_start_date
        context_payload["replan_trigger"] = "critical_injury_override"

    weekly_plan, trace, err_msg = generate_weekly_plan_json(
        context_payload=context_payload,
        model=model,
        ctx=ctx,
    )

    if not weekly_plan:
        print(f"[WEEKLY-PLAN] AI Generation failed: {err_msg}")
        return {
            "ok": False,
            "code": trace.get("error_code") or "ai_generation_failed",
            "message": err_msg,
        }

    model_used = str(trace.get("ok_model") or weekly_plan.get("model") or "unknown")

    _log_ai_usage(
        user_id, trace, model_used, "coach.generate_weekly_plan",
        meta={
            "state_id": used_state_id,
            "requested_weeks": weeks,
            "horizon_weeks": horizon_weeks,
            "target_end_date": target_end_date,
            "plan_meta_id": plan_meta_id,
        },
        ctx=ctx,
    )

    deleted_rows = 0
    if full_reset:
        # plan_meta_id je tu vždy None (nový plán) - db_clear s None je no-op
        # (nemá čo mazať, žiadny predošlý meta pre tento konkrétny nový plán
        # neexistuje). Staré nedokončené drafty tohto usera TÝMTO nemažeme -
        # to je samostatná téma (čistenie osirotených 'generated' meta
        # záznamov), zámerne mimo rozsahu tejto zmeny.
        deleted_rows = db_clear_weekly_for_user_plan(user_id=user_id, plan_meta_id=plan_meta_id, ctx=ctx)
    elif overwrite:
        today_iso = _date.today().isoformat()
        deleted_rows = db_delete_current_and_future_weekly_plans(
            user_id=user_id, plan_meta_id=plan_meta_id, from_date_iso=today_iso, ctx=ctx
        )

    weeks_list = extract_weeks_payload(weekly_plan)

    allowed_indices = {
        int(idx)
        for wb in (context_payload.get("week_boundaries") or [])
        if (idx := wb.get("week_index")) is not None
    }
    if allowed_indices:
        before_count = len(weeks_list)
        weeks_list = [
            w for w in weeks_list
            if isinstance(w, dict) and int(w.get("week_index") or -1) in allowed_indices
        ]
        dropped = before_count - len(weeks_list)
        if dropped > 0:
            print(
                f"[WEEKLY-PLAN][user={user_id}] AI vrátila {dropped} týždňov "
                f"NAVYŠE mimo požadovaného rozsahu (allowed={sorted(allowed_indices)}) "
                "- zahodené."
            )
        returned_indices = {
            int(idx) for w in weeks_list if (idx := w.get("week_index")) is not None
        }
        missing = allowed_indices - returned_indices
        if missing:
            print(
                f"[WEEKLY-PLAN][user={user_id}] AI NEvygenerovala týždne "
                f"{sorted(missing)} z požadovaného rozsahu - v pláne budú chýbať."
            )

    rows = build_weekly_rows_from_ai(user_id=user_id, weeks_list=weeks_list, plan_meta_id=plan_meta_id)
    inserted_rows_data = db_insert_weekly_rows(rows, ctx=ctx)
    inserted_rows = len(inserted_rows_data)

    if context.get("ephemeral_note_id"):
        try:
            service_consume_pending_ephemeral(user_id=user_id, ctx=ctx)
        except Exception as e:
            print(f"❌ [WEEKLY] consume ephemeral error: {repr(e)}")

    plan_meta_dict = (
        weekly_plan.get("plan_meta") if isinstance(weekly_plan, dict) else {}
    ) or {}
    start_date: Optional[str] = plan_meta_dict.get("start_date") or None
    end_date: Optional[str] = plan_meta_dict.get("end_date") or None

    if not start_date and weeks_list:
        start_date = weeks_list[0].get("week_start") or None
    if not end_date and weeks_list:
        end_date = (
            weeks_list[-1].get("week_end")
            or weeks_list[-1].get("week_start")
            or None
        )

    meta_row: Optional[Dict[str, Any]] = existing_meta

    if plan_meta_id is None:
        # Prvotné generovanie - meta záznam vzniká TERAZ, s reálnymi
        # dátami z toho, čo AI naozaj vygenerovala. Hneď potom dopíšeme
        # jeho id na práve vložené weekly riadky.
        meta_row = db_insert_plan_meta_generated(
            user_id=user_id,
            weeks_total=len(weeks_list) or horizon_weeks,
            start_date=start_date,
            end_date=end_date,
            ctx=ctx,
        )
        new_meta_id = meta_row.get("id") if meta_row else None
        if new_meta_id is not None:
            row_ids = [r["id"] for r in inserted_rows_data if r.get("id") is not None]
            db_set_plan_meta_id_for_weekly_rows(row_ids, new_meta_id, ctx=ctx)
            plan_meta_id = new_meta_id

    # Po replane prepočítame actual_stats pre VŠETKY týždne TOHTO plánu
    if overwrite:
        try:
            all_weeks = db_get_weekly_for_user_plan(user_id=user_id, plan_meta_id=plan_meta_id, ctx=ctx)
            for w in all_weeks:
                w_start = w.get("week_start")
                if not w_start:
                    continue
                try:
                    service_sync_weekly_volume_for_date(
                        user_id=user_id, plan_meta_id=plan_meta_id, target_date=w_start, ctx=ctx
                    )
                except Exception as e:
                    print(f"❌ [WEEKLY] resync week_index={w.get('week_index')} failed: {repr(e)}")
        except Exception as e:
            print(f"❌ [WEEKLY] resync all weeks failed: {repr(e)}")

    resp: Dict[str, Any] = {
        "ok": True,
        "state_id": used_state_id,
        "model": model_used,
        "overwrite": True,
        "weeks": horizon_weeks,
        "plan_meta_id": plan_meta_id,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "coach_reply": weekly_plan.get("coach_reply") if isinstance(weekly_plan, dict) else None,
        "weekly_plan": weekly_plan,
        "error": None,
    }
    if meta_row is not None:
        resp["plan_meta"] = meta_row

    return resp


# ============================================================
# READ
# ============================================================

def service_get_latest_weekly_plan(
    user_id: int, plan_meta_id: Optional[int] = None, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """
    Načíta weekly plán z DB.

    plan_meta_id: NOVÉ - ak nie je zadaný, dohľadá si aktívny/najnovší meta
    záznam sám (zachováva staré správanie pre volania bez tejto informácie).
    """
    if plan_meta_id is None:
        meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx) or db_get_latest_plan_meta_for_user(user_id=user_id, ctx=ctx)
        plan_meta_id = meta.get("id") if meta else None

    rows = db_get_weekly_for_user_plan(user_id=user_id, plan_meta_id=plan_meta_id, ctx=ctx)
    if not rows:
        return None

    weeks_out: List[Dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: int(x.get("week_index") or 0)):
        weeks_out.append({
            "week_index": int(r.get("week_index") or 0),
            "week_start": r.get("week_start"),
            "week_end": r.get("week_end"),
            "goal": r.get("goal"),
            "focus": r.get("focus"),
            "load_phase": r.get("load_phase"),
            "planned_stats": r.get("planned_stats") or {},
            "actual_stats": r.get("actual_stats") or {},
            "notes": r.get("notes"),
        })

    return {"weeks": weeks_out}


# ============================================================
# WEEKLY VOLUME SYNC
# ============================================================

def service_sync_weekly_volume_for_date(
    user_id: int,
    target_date: str,
    *,
    plan_meta_id: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Synchronizuje actual_stats pre týždeň TOHTO PLÁNU obsahujúci target_date.
    plan_meta_id: NOVÉ - ak None, dohľadá aktívny plán usera sám (zachováva
    staré správanie pre volania, ktoré ho ešte neposielajú, napr. sync
    jednotlivej aktivity zo Stravy).
    """
    if plan_meta_id is None:
        meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
        plan_meta_id = meta.get("id") if meta else None

    week_row = db_get_weekly_row_by_date(
        user_id=user_id, plan_meta_id=plan_meta_id, target_date_iso=target_date, ctx=ctx
    )
    if not week_row:
        return {
            "ok": False,
            "note": f"Date {target_date[:10]} does not fall into any active plan week.",
        }

    week_start = week_row["week_start"]
    week_end = week_row["week_end"]
    row_id = week_row["id"]

    activities = db_get_activities_in_range_basic(
        ctx=ctx,
        user_id=user_id,
        start_ts_iso=f"{week_start}T00:00:00Z",
        end_ts_iso=f"{week_end}T23:59:59Z",
    )

    stats: Dict[str, Any] = {
        "run_distance_km": 0.0,
        "run_time_min": 0,
        "bike_distance_km": 0.0,
        "bike_time_min": 0,
        "swim_distance_m": 0.0,
        "swim_time_min": 0,
        "strength_time_min": 0,
        "other_time_min": 0,
    }

    for act in activities:
        act_type = str(
            act.get("sport_type") or act.get("sport_type_fe") or ""
        ).lower()
        dist_m = float(act.get("distance_m") or 0.0)
        time_min = int(float(act.get("moving_time_s") or 0.0) / 60)

        if "run" in act_type:
            stats["run_distance_km"] += dist_m / 1000.0
            stats["run_time_min"] += time_min
        elif any(k in act_type for k in ("ride", "bike", "cycl")):
            stats["bike_distance_km"] += dist_m / 1000.0
            stats["bike_time_min"] += time_min
        elif "swim" in act_type:
            stats["swim_distance_m"] += dist_m
            stats["swim_time_min"] += time_min
        elif any(k in act_type for k in ("weight", "strength", "workout")):
            stats["strength_time_min"] += time_min
        else:
            stats["other_time_min"] += time_min

    stats["run_distance_km"] = round(stats["run_distance_km"], 2)
    stats["bike_distance_km"] = round(stats["bike_distance_km"], 2)
    stats["swim_distance_m"] = round(stats["swim_distance_m"], 2)

    success = db_update_weekly_actual_stats(
        row_id=row_id, actual_stats=stats, ctx=ctx
    )

    return {
        "ok": success,
        "week_index": week_row.get("week_index"),
        "processed_activities": len(activities),
        "actual_stats_saved": stats,
    }