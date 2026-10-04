# Services/AI/daily_plan/main.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from Configs.config import (
    COACH_PLAN_SCAN_HORIZON_DAYS,
    COACH_PLAN_GENERATE_MIN_HORIZON_DAYS,
)
from Services.AI.daily_plan.generate import generate_daily_week_json
from DB.coach_plan_daily import (
    db_clear_daily_for_user_range,
    db_delete_daily_for_user_range_returning,
    db_restore_daily_rows,
    db_insert_daily_rows,
    db_list_daily_for_user_horizon,
    db_update_daily_session_data,
)
from DB.coach_plan_weekly import db_get_weekly_for_user_plan
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Services.coach_mode import service_get_coach_mode
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.AI.daily_plan.builders import (
    build_daily_context_from_db,
    build_daily_rows_from_ai,
)

from Services.coach_user_notes import service_consume_pending_ephemeral

from Modules.Supabase.auth import AuthCtx

from DB.coach_plan_daily import db_list_daily_for_user_horizon

# ============================================================
# HELPERS
# ============================================================


def _reindex_sessions_per_day(daily_plan: Dict[str, Any]) -> Dict[str, Any]:
    """Opraví session_index v každom dni — zaručí 0-based sekvenciu."""
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
        dict_sessions = [s for s in sessions if isinstance(s, dict)]
        for i, s in enumerate(dict_sessions):
            s["session_index"] = i
        day["sessions"] = dict_sessions
    return daily_plan


def _log_ai_usage(
    user_id: int,
    trace: Dict[str, Any],
    model: str,
    week_index: int,
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
            job_type="coach.generate_daily_plan",
            source="user",
            billed_via="internal",
            charge_wallet=False,
            meta={
                "week_index": week_index,
                "provider": trace.get("ok_provider"),
                "model": trace.get("ok_model"),
            },
            ctx=ctx,
        )
    except Exception as e:
        print(f"[AI_BILLING] daily_plan error: {repr(e)}")


def _resolve_plan_meta_id(
    user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx
) -> Optional[int]:
    """Ak nebol plan_meta_id explicitne poslaný, dohľadá aktívny plán usera."""
    if plan_meta_id is not None:
        return plan_meta_id
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    return meta.get("id") if meta else None


# ============================================================
# GENERATE DAILY WEEK
# ============================================================


def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_meta_id: Optional[int] = None,
    model: Optional[str] = None,
    drop_past_days: bool = False,
    reason: Optional[str] = None,
    consume_ephemeral: bool = True,  # 🌟 NOVÉ
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Generuje denný tréningový plán pre daný týždeň DANÉHO PLÁNU.

    consume_ephemeral: NOVÉ — ak False, jednorazová poznámka sa NEODMAZE
    po tomto volaní (zostane "pending" pre ďalšie generovanie v tom istom
    reťazci, napr. service_replan_current_week_and_extend nižšie). Default
    True zachováva pôvodné správanie pre všetky ostatné volania.
    """
    
    
    # 🌟 V advisor režime AI plán NIKDY negeneruje - tréningy si pridáva
    # athlete sám. Gate musí byť tu, nie len v auto_extend: túto funkciu
    # volá priamo job "daily_generate" aj autoadjust (soften / weekly
    # replan), takže bez nej by sa ručný plán prepísal.
    if service_get_coach_mode(user_id, ctx=ctx) == "advisor":
        return {
            "ok": False,
            "code": "advisor_mode",
            "message": "V režime Poradca si tréningy pridávaš sám.",
        }

    if week_index <= 0:
        raise ValueError("week_index must be >= 1")


    plan_meta_id = _resolve_plan_meta_id(user_id, plan_meta_id, ctx=ctx)

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI plánov bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    context = build_daily_context_from_db(
        user_id=user_id,
        week_index=week_index,
        plan_meta_id=plan_meta_id,
        ctx=ctx,
    )
    context_payload = context["context_payload"]
    week_meta = context["week_meta"]
    state_row = context["state_row"]

    if reason:
        context_payload["generate_reason"] = reason

    ai_plan, trace, err_msg = generate_daily_week_json(
        context_payload=context_payload,
        model=model,
    )

    if not ai_plan:
        print(f"[DAILY-PLAN] AI Generation failed: {err_msg}")
        return {
            "ok": False,
            "code": trace.get("error_code") or "ai_generation_failed",
            "message": err_msg,
        }

    week_start = (
        str(week_meta.get("week_start") or ai_plan.get("week_start") or "") or None
    )
    week_end = str(week_meta.get("week_end") or ai_plan.get("week_end") or "") or None

    ai_plan.setdefault("week_index", week_index)
    if week_start:
        ai_plan.setdefault("week_start", week_start)
    if week_end:
        ai_plan.setdefault("week_end", week_end)

    days: List[Dict[str, Any]] = ai_plan.get("days") or []
    if len(days) == 0:
        return {
            "ok": False,
            "code": "daily_plan_empty",
            "message": "AI vrátil prázdny plán.",
        }

    model_used = str(trace.get("ok_model") or ai_plan.get("model") or "unknown")

    ai_plan = _reindex_sessions_per_day(ai_plan)

    # 🌟 ODSTRÁNENÉ: extract_and_save_ai_strength_history (coach_strength_mapper).
    # Kŕmilo len prepare_strength_context_for_ai (recency menu pre starý
    # plochý AI výber cvikov), ktoré builders.py už nevolá od zapojenia
    # deterministickej vrstvy (templates.py + selector.py). Overené, že
    # coach_strength_mapper.py aj coach_strength_history sa nepoužívajú
    # nikde inde v repe - bezpečné vypnúť. Recency/rotáciu teraz rieši
    # build_usage_map() nad reálne odcvičenými strength_sessions.

    dates: List[str] = []
    for d in days:
        if not isinstance(d, dict):
            continue
        v = d.get("date") or d.get("plan_date")
        if isinstance(v, str) and v:
            dates.append(v[:10])

    date_from = min(dates) if dates else None
    date_to = max(dates) if dates else None
    today_iso = date.today().isoformat()

    if drop_past_days and date_from and date_from < today_iso:
        date_from = today_iso

    rows_to_insert = build_daily_rows_from_ai(
        user_id=user_id, daily_plan=ai_plan, plan_meta_id=plan_meta_id
    )
    if drop_past_days:
        rows_to_insert = [
            r for r in rows_to_insert if str(r.get("plan_date", "")) >= today_iso
        ]

    # Riadky sa skladajú PRED mazaním: keď z AI výstupu nevznikne ani jeden
    # použiteľný deň, starý plán ostane a user za prázdny výstup neplatí.
    if not rows_to_insert:
        print(f"[DAILY-PLAN] user={user_id} week={week_index} no usable rows, not billed")
        return {
            "ok": False,
            "code": "daily_plan_empty",
            "message": "AI vrátil prázdny plán.",
        }

    # Zmazané riadky si držíme ako zálohu - keď insert zlyhá, vrátia sa
    # späť, aby user neprišiel o plán (Supabase REST nemá transakciu).
    backup_rows: List[Dict[str, Any]] = []
    if date_from and date_to:
        deleted = db_delete_daily_for_user_range_returning(
            user_id=user_id,
            plan_meta_id=plan_meta_id,
            date_from=date_from,
            date_to=date_to,
            ctx=ctx,
        )
        if deleted is None:
            # Starý plán sa nezmazal - nový by sa k nemu pridal ako duplicita.
            return {
                "ok": False,
                "code": "plan_save_failed",
                "message": "Plán sa nepodarilo uložiť.",
            }
        backup_rows = deleted
    deleted_rows = len(backup_rows)

    inserted_rows_data = db_insert_daily_rows(rows_to_insert, ctx=ctx)
    inserted_rows = len(inserted_rows_data)

    if not inserted_rows:
        restored = db_restore_daily_rows(backup_rows, ctx=ctx)
        print(
            f"[DAILY-PLAN] user={user_id} week={week_index} insert failed, "
            f"restored {restored}/{len(backup_rows)} rows, not billed"
        )
        return {
            "ok": False,
            "code": "plan_save_failed",
            "message": "Plán sa nepodarilo uložiť.",
        }

    # Billing až po uložení - plán, ktorý sa nezapísal, user neuvidí.
    _log_ai_usage(user_id, trace, model_used, week_index, ctx)

    # 🌟 FIX: spotreba ephemeral poznámky je teraz podmienená - keď
    # service_replan_current_week_and_extend reťazí viacero generovaní
    # (aktuálny týždeň + prípadný auto-extend budúceho), chceme, aby
    # poznámka platila pre CELÝ reťazec, nie len pre prvé volanie. Preto sa
    # tu môže táto spotreba zámerne preskočiť a urobí sa raz, na konci,
    # volajúcou funkciou.
    if consume_ephemeral and context.get("ephemeral_note_id"):
        try:
            service_consume_pending_ephemeral(user_id=user_id, ctx=ctx)
        except Exception as e:
            print(f"❌ [DAILY] consume ephemeral error: {repr(e)}")

    return {
        "ok": True,
        "daily_plan": ai_plan,
        "week_index": week_index,
        "plan_meta_id": plan_meta_id,
        "week_start": ai_plan.get("week_start") or week_meta.get("week_start"),
        "week_end": ai_plan.get("week_end") or week_meta.get("week_end"),
        "state_id": (state_row or {}).get("id"),
        "model": model_used,
        "overwrite": True,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
        "error": None,
    }


# ============================================================
# READ
# ============================================================

def _external_event_sessions(
    user_id: int, *, date_from: date, date_to: date, ctx: AuthCtx
) -> Dict[str, List[Dict[str, Any]]]:
    """
    🌟 NOVÉ: opakujúce sa externé aktivity z prefs ako položky denného
    plánu, zoskupené podľa dátumu.

    PREČO MERGE PRI ČÍTANÍ A NIE ZÁPIS DO DB:
    externé aktivity sú DEFINÍCIE opakovania (futbal každú stredu), nie
    konkrétne dni. Keby sa zapisovali do coach_plan_daily, pri zmene alebo
    zrušení opakovania by v pláne ostali staré riadky a user by ich musel
    mazať ručne. Takto sú vždy aktuálne a nedajú sa omylom zmazať ako
    tréning.

    Platí pre OBA režimy - athlete musí vidieť, čo ho v týždni čaká, bez
    ohľadu na to, či mu plán skladá AI alebo on sám.

    id je záporné a odvodené od dátumu a poradia, aby sa nepomiešalo s
    reálnymi riadkami plánu. FE podľa toho pozná, že sa nedá upraviť.
    """
    try:
        from Services.coach_external_events import service_list_external_events_window

        res = service_list_external_events_window(
            user_id=user_id,
            from_iso=date_from.isoformat(),
            to_iso=date_to.isoformat(),
            match_activities=True,
            ctx=ctx,
        )
        occurrences = res.get("occurrences") or []
    except Exception as e:  # noqa: BLE001
        print(f"[DAILY] external events merge failed user={user_id}: {repr(e)}")
        return {}

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for idx, ev in enumerate(occurrences):
        if not isinstance(ev, dict):
            continue
        d = str(ev.get("occurrence_date") or "")[:10]
        if not d:
            continue

        sport = str(ev.get("sport") or "").strip() or "other"

        by_date.setdefault(d, []).append({
            "id": -(idx + 1),
            "plan_date": d,
            "session_index": 90 + len(by_date.get(d, [])),
            "sport": sport,
            "title": ev.get("title") or "Externá aktivita",
            "duration_min": ev.get("duration_min"),
            "intensity": None,
            "notes": ev.get("notes"),
            "session_type": "external_event",
            # náročnosť a druh nesie štruktúra udalosti (viď
            # coach_external_events.external_event_structure)
            "structure": ev.get("structure"),
            # None, nie {} - FE berie `payload ?? riadok` a z prázdneho
            # payloadu by stratil názov aj šport
            "payload": None,
            # spárovanie s aktivitou zo Stravy sa počíta pri čítaní
            "status": ev.get("status") or "planned",
            "activity_id": ev.get("activity_id"),
            "is_external": True,
            "start_time_local": ev.get("start_time_local"),
            "external_intensity": ev.get("intensity"),
        })

    return by_date


def service_get_daily_overview(
    user_id: int,
    horizon_days: int = 7,
    *,
    plan_meta_id: Optional[int] = None,
    include_external: bool = True,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Načíta denný prehľad tréningov DANÉHO PLÁNU pre daný horizont.

    include_external: zlúči do prehľadu aj opakujúce sa externé aktivity
    z prefs (futbal v stredu, tanec v piatok). Nie sú v coach_plan_daily,
    takže sa pridávajú až tu - viď _external_event_sessions.
    """
    if horizon_days <= 0:
        horizon_days = 7

    plan_meta_id = _resolve_plan_meta_id(user_id, plan_meta_id, ctx=ctx)

    rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            plan_meta_id=plan_meta_id,
            horizon_days=horizon_days,
            ctx=ctx,
        )
        or []
    )

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        d = r.get("plan_date")
        if not d:
            continue
        key = str(d)[:10]
        by_date.setdefault(key, []).append(r)

    today = date.today()
    end_day = today + timedelta(days=horizon_days)

    external_by_date: Dict[str, List[Dict[str, Any]]] = {}
    if include_external:
        external_by_date = _external_event_sessions(
            user_id, date_from=today, date_to=end_day, ctx=ctx
        )

    days_out: List[Dict[str, Any]] = []

    d = today
    while d <= end_day:
        date_str = d.isoformat()
        sessions = by_date.get(date_str, [])
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
                    "id": s.get("id"),
                    "plan_date": str(s.get("plan_date") or "")[:10],
                    "session_index": int(s.get("session_index") or 0),
                    "sport": s.get("sport") or "other",
                    "title": s.get("title"),
                    "duration_min": s.get("duration_min"),
                    "intensity": s.get("intensity"),
                    "notes": s.get("notes"),
                    "session_type": s.get("session_type"),
                    "structure": structure,
                    "payload": payload,
                    "status": s.get("status"),
                    "activity_id": s.get("activity_id"),
                }
            )

        # Externé aktivity idú za naplánované tréningy daného dňa.
        sessions_out.extend(external_by_date.get(date_str, []))

        days_out.append({"date": date_str, "sessions": sessions_out})
        d += timedelta(days=1)

    return {"horizon_days": horizon_days, "days": days_out}

# ============================================================
# AUTO EXTEND
# ============================================================



def service_auto_extend_daily_plan(
    user_id: int,
    *,
    min_horizon_days: int = 4,
    plan_meta_id: Optional[int] = None,
    consume_ephemeral: bool = True,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Automaticky rozšíri denný plán DANÉHO PLÁNU ak zostáva menej ako
    min_horizon_days dní. Pri aktuálnom týždni zachová odtrénované dni.

    consume_ephemeral: prenáša sa do každého vnútorného volania
    service_generate_daily_week. Default True (bežné automatické volanie
    po synchronizácii aktivity si poznámku spotrebuje samo). False sa
    používa len z service_replan_current_week_and_extend, kde poznámku
    spotrebúva až volajúci, na úplnom konci reťazca.

    🌟 V advisor režime sa nič negeneruje - athlete si plán stavia sám.
    Táto funkcia je centrálny vstupný bod pre "daily_extend" job, ktorý sa
    enqueue-uje po každom "plan_match" (teda po každom importe aktivity zo
    Stravy), takže gate tu pokrýva celú automatickú cestu. Dôležité aj pri
    prepnutí coach -> advisor uprostred plánu: weekly riadky ostanú v DB
    a bez tejto poistky by z nich extend ďalej generoval denné tréningy.
    """
    if service_get_coach_mode(user_id, ctx=ctx) == "advisor":
        return {"changed": False, "reason": "advisor_mode"}

    if min_horizon_days <= 0:
        min_horizon_days = 6

    plan_meta_id = _resolve_plan_meta_id(user_id, plan_meta_id, ctx=ctx)

    today = date.today()

    daily_rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            plan_meta_id=plan_meta_id,
            horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS,
            ctx=ctx,
        )
        or []
    )
    if not daily_rows:
        return {"changed": False, "reason": "no_daily_rows"}

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
        db_get_weekly_for_user_plan(user_id=user_id, plan_meta_id=plan_meta_id, ctx=ctx)
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
    target_weeks: List[int] = []

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
            if we > last_date:
                target_weeks.append(current_week_index)
        elif ws > last_date:
            target_weeks.append(int(w.get("week_index") or 0))

    if not target_weeks:
        return {
            "changed": False,
            "reason": "no_future_weeks_needed",
            "current_week_index": current_week_index,
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    generated: List[int] = []
    current_last_str = last_date_str

    for week_idx in target_weeks:
        is_current_week = week_idx == current_week_index
        res = service_generate_daily_week(
            user_id=user_id,
            week_index=week_idx,
            plan_meta_id=plan_meta_id,
            model=None,
            drop_past_days=is_current_week,
            reason="refill_auto_extend",
            consume_ephemeral=consume_ephemeral,  # 🌟 NOVÉ - prenesené ďalej
            ctx=ctx,
        )
        if res.get("ok"):
            generated.append(week_idx)

        daily_rows = (
            db_list_daily_for_user_horizon(
                user_id=user_id,
                plan_meta_id=plan_meta_id,
                horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS,
                ctx=ctx,
            )
            or []
        )
        if daily_rows:
            current_last_str = max(
                str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
            )
            days_left = (date.fromisoformat(current_last_str) - today).days
            if days_left >= min_horizon_days:
                break

    return {
        "changed": bool(generated),
        "generated_weeks": generated,
        "current_week_index": current_week_index,
        "final_days_left": days_left,
        "last_daily_date": current_last_str,
    }


# ============================================================
# SESSION STATUS UPDATE
# ============================================================


def service_update_daily_session_status(
    user_id: int,
    session_id: int,
    status: Optional[str],
    activity_id: Optional[int],
    unmatch: bool,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Spracuje manuálne zásahy do denného tréningu: Postpone, Match, Unmatch.
    Nezmenené - operuje na konkrétnom session_id, ktoré je už jednoznačné
    bez ohľadu na to, ktorému plánu patrí.
    """
    update_data: Dict[str, Any] = {}

    if unmatch:
        update_data["activity_id"] = None
        update_data["status"] = "planned"
    else:
        if activity_id is not None:
            update_data["activity_id"] = activity_id
            update_data["status"] = "done"
        if status is not None:
            update_data["status"] = status

    if not update_data:
        return {"success": True, "data": None, "message": "No changes requested"}

    row = db_update_daily_session_data(
        user_id=user_id, session_id=session_id, update_data=update_data, ctx=ctx
    )
    if not row:
        raise ValueError("Session not found or update failed")

    return {"success": True, "data": row, "message": "Session updated successfully"}


def service_replan_current_week_and_extend(
    user_id: int,
    *,
    week_index: int,
    plan_meta_id: Optional[int] = None,
    model: Optional[str] = None,
    min_horizon_days: Optional[int] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    🌟 NOVÉ: "Uprav dni" v jednom atomickom kroku.

    1. Regeneruje aktuálny týždeň (week_index) bez zásahu do minulosti
       (drop_past_days=True).
    2. Skontroluje horizont a ak treba, automaticky dogeneruje aj ďalší
       týždeň (rovnaký mechanizmus ako po synchronizácii aktivity).
    3. Ephemeral (jednorazová) poznámka sa spotrebuje AŽ NA KONCI, raz -
       vďaka tomu platí pre celý reťazec (aktuálny týždeň AJ prípadný
       dogenerovaný budúci), nie len pre prvý krok.

    Ak krok 1 zlyhá, krok 2 sa vôbec nespustí a poznámka sa nespotrebuje
    (zostáva "pending" pre ďalší pokus).

    🌟 NOVÉ: v advisor režime toto tlačidlo vo FE nemá existovať, ale
    kontrola je aj tu (defense in depth) - keby sem prišlo volanie,
    nič neprepíše ručný plán.
    """
    if service_get_coach_mode(user_id, ctx=ctx) == "advisor":
        return {
            "ok": False,
            "code": "advisor_mode",
            "message": "Replan nie je dostupný v advisor režime.",
        }

    current = service_generate_daily_week(
        user_id=user_id,
        week_index=week_index,
        plan_meta_id=plan_meta_id,
        model=model,
        drop_past_days=True,
        reason="manual_replan",
        consume_ephemeral=False,
        ctx=ctx,
    )
    if not current.get("ok"):
        return current

    resolved_plan_meta_id = current.get("plan_meta_id") or plan_meta_id

    extend_result = service_auto_extend_daily_plan(
        user_id=user_id,
        plan_meta_id=resolved_plan_meta_id,
        min_horizon_days=min_horizon_days or COACH_PLAN_GENERATE_MIN_HORIZON_DAYS,
        consume_ephemeral=False,
        ctx=ctx,
    )

    try:
        service_consume_pending_ephemeral(user_id=user_id, ctx=ctx)
    except Exception as e:
        print(f"❌ [DAILY] final consume ephemeral error: {repr(e)}")

    return {
        "ok": True,
        "current_week": current,
        "extend": extend_result,
        "week_index": week_index,
        "plan_meta_id": resolved_plan_meta_id,
    }