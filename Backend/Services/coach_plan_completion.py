# Services/coach_plan_completion.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

from DB.coach_plan_meta import db_get_active_plan_meta_for_user, db_archive_plan_meta
from DB.coach_plan_weekly import db_get_weekly_for_user_plan
from DB.coach_plan_daily import db_get_last_planned_daily_session_for_user
from DB.coach_plan_summaries import (
    db_insert_plan_summary,
    db_get_summary_exists_for_plan,
)
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.AI.plan_completion.generate import service_generate_plan_completion_summary


RACE_GOAL_KM: Dict[str, float] = {
    "5k": 5.0,
    "10k": 10.0,
    "half": 21.0975,
    "marathon": 42.195,
}

DISTANCE_TOLERANCE_PCT = 0.10  # ±10 %


# ============================================================
# RACE HELPERS
# ============================================================

def _target_distance_km(race: Dict[str, Any]) -> Optional[float]:
    """
    Vytiahne cieľovú vzdialenosť pretekov v km.

    custom_distance_km je hodnota, ktorú user zadal pri voľbe 'other'/'ultra'
    (frontend GoalSection.tsx). Pri štandardných voľbách (5k/10k/half/
    marathon) je custom_distance_km null a reálna vzdialenosť sa odvodí
    z race_goal -> RACE_GOAL_KM (prepis toho, čo user zvolil kliknutím,
    nie vymyslený katalóg).
    """
    custom = race.get("custom_distance_km")
    if isinstance(custom, (int, float)) and custom > 0:
        return float(custom)

    goal = race.get("race_goal")
    if goal in RACE_GOAL_KM:
        return RACE_GOAL_KM[goal]

    return None


def _all_races(prefs: Dict[str, Any]) -> List[Dict[str, Any]]:
    targets = prefs.get("targets") or {}
    run_targets = targets.get("run") or {}
    races = run_targets.get("races") or []
    return [r for r in races if isinstance(r, dict)]


def _find_matching_race(
    prefs: Dict[str, Any],
    activity_date_iso: str,
    activity_distance_km: float,
) -> Optional[Dict[str, Any]]:
    """
    Nájde AKÝKOĽVEK pretek (bez ohľadu na prioritu - A, B, C, D...) z
    prefs.targets.run.races, ktorého dátum sa PRESNE zhoduje s dátumom
    aktivity a vzdialenosť je v tolerancii ±10 %.
    """
    act_date_only = str(activity_date_iso)[:10]

    for race in _all_races(prefs):
        race_date = race.get("date")
        if not race_date or str(race_date)[:10] != act_date_only:
            continue

        target_km = _target_distance_km(race)
        if not target_km:
            continue

        diff_ratio = abs(activity_distance_km - target_km) / target_km
        if diff_ratio > DISTANCE_TOLERANCE_PCT:
            continue

        return race

    return None


def _pick_primary_race(prefs: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Pre manuálny (on-demand) trigger vyberá "hlavný" pretek na zobrazenie v
    sumári - uprednostní prioritu A, potom B, C, D..., inak prvý v zozname.
    Nemá vplyv na automatickú detekciu dokončenia (tá berie hociktorý pretek
    podľa dátumu+vzdialenosti, nie podľa priority).
    """
    races = _all_races(prefs)
    if not races:
        return None
    priority_order: Dict[str, int] = {"A": 0, "B": 1, "C": 2, "D": 3}
    races_sorted = sorted(
        races,
        key=lambda r: priority_order.get(str(r.get("priority") or ""), 99),
    )
    return races_sorted[0]

# ============================================================
# END-OF-PLAN HELPER (nezávislé od preteku)
# ============================================================

def _is_last_plan_session_match(
    user_id: int,
    activity_date_iso: str,
    *,
    ctx: AuthCtx,
) -> bool:
    """
    Plán sa považuje za dokončený vtedy, keď naimportovaná aktivita dátumom
    zodpovedá poslednej reálnej (nie rest-day) tréningovej session v
    aktuálnom dennom pláne. Toto je NEZÁVISLÉ od toho, či existuje cieľový
    pretek - platí to aj keď pretek je, len vychádza na iný dátum než koniec
    plánu (typický prípad: pretek o týždeň, plán beží ešte mesiac).
    """
    last_session = db_get_last_planned_daily_session_for_user(user_id, ctx=ctx)
    if not last_session:
        return False

    last_plan_date = str(last_session.get("plan_date") or "")[:10]
    act_date_only = str(activity_date_iso)[:10]

    return bool(last_plan_date) and last_plan_date == act_date_only


# ============================================================
# STATS AGGREGATION
# ============================================================

def _aggregate_weekly_stats(weeks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Sčíta planned_stats/actual_stats naprieč všetkými týždňami plánu."""
    final_planned: Dict[str, float] = {}
    final_actual: Dict[str, float] = {}

    for w in weeks:
        ps = w.get("planned_stats") or {}
        as_ = w.get("actual_stats") or {}
        for k, v in ps.items():
            final_planned[k] = final_planned.get(k, 0) + (v or 0)
        for k, v in as_.items():
            final_actual[k] = final_actual.get(k, 0) + (v or 0)

    for k in final_planned:
        if isinstance(final_planned[k], float):
            final_planned[k] = round(final_planned[k], 2)
    for k in final_actual:
        if isinstance(final_actual[k], float):
            final_actual[k] = round(final_actual[k], 2)

    return {"planned": final_planned, "actual": final_actual}


# ============================================================
# SHARED BUILDER (spoločné pre auto aj manuálny trigger)
# ============================================================

def _build_and_save_summary(
    *,
    user_id: int,
    meta: Dict[str, Any],
    matching_race: Optional[Dict[str, Any]],
    activity: Optional[Dict[str, Any]],
    trigger_type: str,
    is_plan_completed: bool,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    from datetime import date

    meta_id = meta.get("id")

    weeks = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx)
    aggregated = _aggregate_weekly_stats(weeks)
    prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)

    activity_date = activity.get("date") if activity else None
    distance_m = activity.get("distance_m") if activity else None
    moving_time_s = activity.get("moving_time_s") if activity else None

    activity_distance_km = float(distance_m) / 1000.0 if distance_m else None
    actual_time_s = int(moving_time_s) if moving_time_s else None
    target_km = _target_distance_km(matching_race) if matching_race else None

    # 🌟 KRITICKÉ: weekly_trend posielaný do AI sa filtruje LEN na týždne,
    # ktoré už reálne prebehli alebo prebiehajú (week_end <= dnes). Bez
    # tohto filtra AI vidí aj BUDÚCE týždne plánu (tie sa v DB vytvárajú
    # vopred pre celý cyklus naraz) s prirodzene prázdnym actual_stats, a
    # mylne si to vyloží ako "user prestal trénovať X týždňov pred
    # pretekom" - presne tento bug spôsobil nezmyselný "6 týždňov bez
    # aktivity" text pri checkpointe tesne pred pretekom.
    today_iso = date.today().isoformat()

    def _week_end_str(w: Dict[str, Any]) -> str:
        return str(w.get("week_end") or "")[:10]

    elapsed_weeks = [w for w in weeks if _week_end_str(w) and _week_end_str(w) <= today_iso]
    future_weeks_count = len(weeks) - len(elapsed_weeks)

    summary_row: Dict[str, Any] = {
        "user_id": user_id,
        "plan_meta_id": meta_id,
        "activity_id": activity.get("activity_id") if activity else None,
        "race_name": matching_race.get("name") if matching_race else None,
        "race_date": str(activity_date)[:10] if activity_date else (
            str(matching_race.get("date"))[:10] if matching_race and matching_race.get("date") else None
        ),
        "race_target_time": matching_race.get("target_time") if matching_race else None,
        "race_actual_time_s": actual_time_s,
        "race_target_distance_km": target_km,
        "race_actual_distance_km": round(activity_distance_km, 2) if activity_distance_km else None,
        "weeks_tracked": len(weeks),
        "planned_stats": aggregated["planned"],
        "actual_stats": aggregated["actual"],
        "trigger_type": trigger_type,
        "is_plan_completed": is_plan_completed,
    }

    try:
        ai_out = service_generate_plan_completion_summary(
            user_id=user_id,
            race=matching_race,
            goal_kind=prefs.get("goal_kind"),
            plan_start_date=meta.get("start_date"),
            plan_end_date=meta.get("end_date"),
            weeks_total=meta.get("weeks_total"),
            aggregated=aggregated,
            weeks=elapsed_weeks,  # 🌟 len prebehnuté/prebiehajúce, nie celý plán
            future_weeks_count=future_weeks_count,
            today_iso=today_iso,
            actual_time_s=actual_time_s,
            target_km=target_km,
            actual_km=activity_distance_km,
            is_plan_completed=is_plan_completed,
            ctx=ctx,
        )
        if ai_out.get("ok"):
            ai_data = ai_out.get("data") or {}
            summary_row["ai_headline"] = ai_data.get("headline")
            summary_row["ai_summary_text"] = ai_data.get("summary_text")
            summary_row["raw_ai_json"] = ai_data
        else:
            print(f"[PLAN_COMPLETION] AI generation not ok user_id={user_id}: {ai_out}")
    except Exception as e:  # noqa: BLE001
        print(f"[PLAN_COMPLETION] AI narrative generation failed user_id={user_id}: {repr(e)}")

    saved = db_insert_plan_summary(summary_row, ctx=ctx)

    if is_plan_completed and meta_id:
        try:
            from datetime import datetime, timezone
            fallback_ended_at = datetime.now(timezone.utc).isoformat()
            db_archive_plan_meta(
                user_id=user_id,
                meta_id=int(meta_id),
                new_status="completed",
                final_stats={
                    "weeks_tracked": len(weeks),
                    "weeks_total_planned": meta.get("weeks_total"),
                    "final_planned_stats": aggregated["planned"],
                    "final_actual_stats": aggregated["actual"],
                },
                ended_at=str(activity_date) if activity_date else fallback_ended_at,
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[PLAN_COMPLETION] archive_plan_meta failed user_id={user_id}: {repr(e)}")

    return saved



# ============================================================
# ENTRYPOINT A: AUTOMATICKÁ DETEKCIA (volaná z importu aktivity)
# ============================================================

def service_check_and_generate_plan_summary(
    *,
    user_id: int,
    activity: Dict[str, Any],
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Zavolať po importe/update KAŽDEJ aktivity. Plán sa považuje za
    dokončený, ak aktivita zodpovedá:
      - hociktorému pretek(u) v prefs (dátum presne + vzdialenosť ±10%,
        bez ohľadu na prioritu A/B/C/D), ALEBO
      - poslednej reálnej (nie rest-day) tréningovej session v pláne.
    Ak sedí oboje naraz (pretek pripadá presne na posledný deň plánu),
    vygeneruje sa sumár LEN RAZ.

    Vracia None ak nedošlo k zhode. Volajúci (synchronization_single.py)
    musí tento call obaliť try/except - chyba tu nesmie zhodiť import.
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or meta.get("status") != "active":
        return None

    meta_id = meta.get("id")
    if not meta_id:
        return None

    # poistka proti duplicitám (re-sync tej istej aktivity / opakovaný webhook)
    if db_get_summary_exists_for_plan(plan_meta_id=meta_id, ctx=ctx):
        return None

    activity_date = activity.get("date")
    distance_m = activity.get("distance_m")
    if not activity_date:
        return None

    prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)

    matching_race: Optional[Dict[str, Any]] = None
    if distance_m:
        activity_distance_km = float(distance_m) / 1000.0
        matching_race = _find_matching_race(prefs, str(activity_date), activity_distance_km)

    is_last_session = _is_last_plan_session_match(user_id, str(activity_date), ctx=ctx)

    if not matching_race and not is_last_session:
        return None

    trigger_type = "race_match" if matching_race else "last_session_match"

    return _build_and_save_summary(
        user_id=user_id,
        meta=meta,
        matching_race=matching_race,
        activity=activity,
        trigger_type=trigger_type,
        is_plan_completed=True,
        ctx=ctx,
    )


# ============================================================
# ENTRYPOINT B: MANUÁLNY "MILESTONE" SUMÁR (volaný z FE, kedykoľvek)
# ============================================================

def service_generate_milestone_summary_on_demand(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vygeneruje "checkpoint" sumár prípravy KEDYKOĽVEK na požiadanie usera,
    bez ohľadu na to, či je plán dokončený. Plán zostáva 'active', nič sa
    nearchivuje - toto je len momentka aktuálneho progresu. Vyžaduje
    aktívny plán (inak vráti chybu).
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or meta.get("status") != "active":
        return {"ok": False, "reason": "no_active_plan"}

    prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)
    primary_race = _pick_primary_race(prefs)

    saved = _build_and_save_summary(
        user_id=user_id,
        meta=meta,
        matching_race=primary_race,
        activity=None,
        trigger_type="manual",
        is_plan_completed=False,
        ctx=ctx,
    )

    if not saved:
        return {"ok": False, "reason": "save_failed"}

    return {"ok": True, "data": saved}