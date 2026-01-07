from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Optional, List

from Services.users import require_jwt
from Services.coach_athlete_state import service_analyze_athlete
from Services.coach_plan_weekly import service_generate_weekly_plan
from Services.coach_plan_daily import (
    service_generate_daily_week,
    service_auto_extend_daily_plan,
)
from Services.analytics_RecentLoad import service_build_recent_load_raw
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_DB.coach_plan_weekly import db_get_weekly_for_user_plan

from Configs.config import WEEKLY_REPLAN_COOLDOWN_DAYS, MIN_DAILY_HORIZON_AFTER_WEEKLY

def _to_date(val: Any) -> Optional[date]:
    """
    Bezpečne spraví date z rôznych typov (datetime / str / date).
    """
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val).date()
        except Exception:
            return None
    return None


def _find_current_week_index(
    weekly_rows: List[Dict[str, Any]],
    *,
    today: date,
) -> Optional[int]:
    """
    Nájde week_index, do ktorého patrí dnešok.

    Logika:
      1) najprv week_start <= today <= week_end
      2) fallback: posledný týždeň s week_start <= today
    """
    if not weekly_rows:
        return None

    # zoradíme podľa week_index (pre istotu)
    weekly_sorted = sorted(
        weekly_rows,
        key=lambda w: int(w.get("week_index") or 0),
    )

    # 1) priame trafiť medzi start/end
    for w in weekly_sorted:
        ws = _to_date(w.get("week_start"))
        we = _to_date(w.get("week_end") or w.get("week_start"))
        if not ws or not we:
            continue
        if ws <= today <= we:
            return int(w.get("week_index") or 0)

    # 2) fallback – posledný týždeň, ktorý už začal
    candidate: Optional[int] = None
    for w in weekly_sorted:
        ws = _to_date(w.get("week_start"))
        if not ws:
            continue
        if ws <= today:
            candidate = int(w.get("week_index") or 0)

    return candidate


def _compute_be_flags_recent_load(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    window_days: int = 42,
) -> Dict[str, Any]:
    """
    BE heuristika nad recent_load – rozhodne, či vôbec má zmysel volať AI.

    Používame weekly agregáty:
      - total_minutes
      - week_index_from_now (0 = aktuálny týždeň, -1 = minulý, ...)

    Princíp:
      - porovnáme current_week vs. priemer posledných 2–3 týždňov
      - rozhodneme, či je to:
          * normálne,
          * mierny spike (skôr softenie daily),
          * veľký spike (skôr weekly replan).
    """
    # recent_load vie fungovať aj so service klientom, takže user_jwt tu nie je povinný
    rl = service_build_recent_load_raw(
        user_id=user_id,
        window_days=window_days,
        user_jwt=user_jwt,
    )

    weeks: List[Dict[str, Any]] = rl.get("weeks") or []

    if not weeks:
        return {
            "has_data": False,
            "should_trigger_ai": False,
            "action": None,
            "reason": "no_recent_load_data",
            "current_week_minutes": None,
            "baseline_minutes": None,
            "ratio": None,
        }

    # nájdi current week (week_index_from_now == 0), fallback na posledný
    current = None
    for w in weeks:
        if w.get("week_index_from_now") == 0:
            current = w
            break
    if current is None:
        current = weeks[-1]

    curr_min = float(current.get("total_minutes") or 0.0)

    # baseline = priemer posledných 2–3 týždňov pred current
    prev_weeks = [
        w
        for w in weeks
        if isinstance(w.get("week_index_from_now"), int)
        and w["week_index_from_now"] < 0
    ]
    prev_weeks_sorted = sorted(
        prev_weeks,
        key=lambda w: int(w.get("week_index_from_now") or 0),
    )

    recent_baseline_weeks = prev_weeks_sorted[-3:] if len(prev_weeks_sorted) >= 3 else prev_weeks_sorted
    if recent_baseline_weeks:
        baseline = sum(float(w.get("total_minutes") or 0.0) for w in recent_baseline_weeks) / len(
            recent_baseline_weeks
        )
    else:
        baseline = curr_min  # fallback – bez histórie ber current ako baseline

    ratio = curr_min / baseline if baseline > 0 else 1.0

    # hard_sessions – ak sú vo weekly
    hard_current = int(current.get("hard_sessions") or 0)

    # jednoduchá heuristika:
    # - ratio <= 1.2 a hard_sessions <= 2 → nič nerieš
    # - 1.2 < ratio <= 1.4 alebo hard_sessions >= 3 → soften daily
    # - ratio > 1.4 alebo curr_min >= baseline + 150 → weekly replan
    if baseline <= 0 and curr_min <= 0:
        return {
            "has_data": True,
            "should_trigger_ai": False,
            "action": None,
            "reason": "no_meaningful_training_load",
            "current_week_minutes": curr_min,
            "baseline_minutes": baseline,
            "ratio": ratio,
            "hard_sessions": hard_current,
        }

    # veľký spike
    if ratio > 1.4 or (curr_min > baseline + 150):
        return {
            "has_data": True,
            "should_trigger_ai": True,
            "action": "weekly_replan",
            "reason": "large_weekly_load_spike",
            "current_week_minutes": curr_min,
            "baseline_minutes": baseline,
            "ratio": ratio,
            "hard_sessions": hard_current,
        }

    # stredný spike / veľa hard sessions → skôr soften daily
    if ratio > 1.2 or hard_current >= 3:
        return {
            "has_data": True,
            "should_trigger_ai": True,
            "action": "daily_soften",
            "reason": "moderate_spike_or_many_hard_sessions",
            "current_week_minutes": curr_min,
            "baseline_minutes": baseline,
            "ratio": ratio,
            "hard_sessions": hard_current,
        }

    # všetko OK → nevolaj AI
    return {
        "has_data": True,
        "should_trigger_ai": False,
        "action": None,
        "reason": "load_within_normal_range",
        "current_week_minutes": curr_min,
        "baseline_minutes": baseline,
        "ratio": ratio,
        "hard_sessions": hard_current,
    }


def service_coach_autoadjust_after_update(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavný orchestratór po nových dátach (activity sync / recovery update).

    Kroky:
      0) BE heuristika (recent_load) → rozhodne, či vôbec volať AI:
         - ak load OK → AI sa NEvolá, plán sa nemení,
         - ak load podozrivý → pokračujeme (ak máme user_jwt).

      1) ak máme user_jwt (RLS context):
         - spraví analyze_athlete → vznikne nový coach_athlete_state s plan_adjustment,
         - načíta aktívny (alebo posledný) plán,
         - podľa plan_adjustment:
             * ak should_replan_weekly a plán nie je čerstvý → weekly re-plan + auto_extend_daily,
             * inak ak soften_next_days.should_soften → regen DAILY pre aktuálny týždeň,
             * inak nič nemení.

      2) ak user_jwt NIE je zadaný (service/webhook režim):
         - spraví iba BE heuristiku (recent_load),
         - NEvolá AI a NEmodifikuje plán,
         - vráti JSON s be_flags, aby si to vedel logovať / debuggovať.
    """
    today = date.today()

    # --- 0) BE heuristika nad recent_load (funguje aj bez JWT – vie použiť service klienta) ---
    be_flags = _compute_be_flags_recent_load(
        user_id=user_id,
        user_jwt=None,  # nech recent_load berie všetky aktivity (service režim)
    )

    # --- 0a) Webhook / čisto service režim (bez JWT) → iba BE analýza, žiadne AI, žiadne zásahy ---
    if not user_jwt:
        return {
            "changed": False,
            "mode": "service_be_only",
            "reason": be_flags.get("reason"),
            "be_flags": be_flags,
            "analyze_state_id": None,
            "plan_adjustment": None,
        }

    # --- 0b) Máme user_jwt → môžeme ísť ďalej (RLS + AI), ale len ak BE chce AI ---
    jwt = require_jwt(user_jwt)

    if not be_flags.get("should_trigger_ai"):
        return {
            "changed": False,
            "mode": "no_adjustment_needed",
            "reason": be_flags.get("reason", "load_within_normal_range"),
            "be_flags": be_flags,
            "analyze_state_id": None,
            "plan_adjustment": None,
        }

    # 1) AI analyze (už s plan_adjustment, ktorý sme pridali v analyze_athlete)
    analyze_resp = service_analyze_athlete(
        user_id=user_id,
        user_jwt=jwt,
        debug=False,
        save_to_db=True,
        model=None,
    )
    state_id = analyze_resp.get("state_id")
    analysis = analyze_resp.get("analysis") or {}
    ai_state = (analysis.get("ai_state") or {})
    plan_adjustment = (ai_state.get("plan_adjustment") or {})

    soften_block = plan_adjustment.get("soften_next_days") or {}
    soften_should = bool(soften_block.get("should_soften"))
    soften_days = soften_block.get("days") or 0
    soften_reason = soften_block.get("reason")

    weekly_replan_should = bool(plan_adjustment.get("should_replan_weekly"))
    weekly_replan_reason = plan_adjustment.get("weekly_replan_reason")

    # 2) nájdeme aktívny / posledný plán
    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    ) or db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    )

    if not meta or not isinstance(meta.get("plan_id"), str):
        # už máme analyze, ale neexistuje plán – nie je čo upravovať
        return {
            "changed": False,
            "mode": "no_plan",
            "reason": "no_plan_meta",
            "be_flags": be_flags,
            "analyze_state_id": state_id,
            "plan_adjustment": plan_adjustment,
        }

    plan_id = meta["plan_id"]

    # koľko dní je plán starý – aby sme ho nereplanovali každú chvíľu
    meta_created = _to_date(meta.get("created_at") or meta.get("generated_at"))
    weekly_age_days: Optional[int] = None
    if meta_created:
        weekly_age_days = (today - meta_created).days

    # 3) rozhodovanie logiky

    # --- 3a) WEEKLY REPLAN (väčší zásah) ---
    if weekly_replan_should:
        # strážime cooldown – nepreplánuj každé 2 hodiny
        if weekly_age_days is not None and weekly_age_days < WEEKLY_REPLAN_COOLDOWN_DAYS:
            # príliš čerstvý plán, necháme to zatiaľ iba na daily (nižšie)
            pass
        else:
            weekly_resp = service_generate_weekly_plan(
                user_id=user_id,
                user_jwt=jwt,
                overwrite=True,
                state_id=state_id,
                weeks=None,
                model=None,
                debug=False,
            )

            # po weekly repláne chceme mať aspoň X dní dopredu aj daily
            daily_extend = service_auto_extend_daily_plan(
                user_id=user_id,
                min_horizon_days=MIN_DAILY_HORIZON_AFTER_WEEKLY,
                user_jwt=jwt,
            )

            return {
                "changed": True,
                "mode": "weekly_replan",
                "reason": weekly_replan_reason
                or "weekly plan re-generated based on load & recovery",
                "be_flags": be_flags,
                "analyze_state_id": state_id,
                "plan_adjustment": plan_adjustment,
                "weekly_plan_meta": {
                    "plan_id": weekly_resp.get("plan_id"),
                    "weeks": weekly_resp.get("weeks"),
                },
                "daily_extend": daily_extend,
            }

    # --- 3b) SOFTEN DAILY (bez menenia weekly meta) ---
    if soften_should and soften_days > 0:
        weekly_rows = (
            db_get_weekly_for_user_plan(
                user_id=user_id,
                plan_id=plan_id,
                user_jwt=jwt,
            )
            or []
        )

        if not weekly_rows:
            return {
                "changed": False,
                "mode": "no_weekly_rows",
                "reason": "no_weekly_rows_for_plan",
                "be_flags": be_flags,
                "analyze_state_id": state_id,
                "plan_adjustment": plan_adjustment,
            }

        current_week_index = _find_current_week_index(
            weekly_rows,
            today=today,
        )

        if current_week_index is None:
            return {
                "changed": False,
                "mode": "cannot_determine_current_week",
                "reason": "cannot_determine_current_week",
                "be_flags": be_flags,
                "analyze_state_id": state_id,
                "plan_adjustment": plan_adjustment,
            }

        daily_resp = service_generate_daily_week(
            user_id=user_id,
            week_index=current_week_index,
            plan_id=plan_id,
            overwrite=True,
            model=None,
            debug=False,
            user_jwt=jwt,
        )

        return {
            "changed": True,
            "mode": "daily_soften",
            "reason": soften_reason
            or f"softening next days (week_index={current_week_index}) based on load & recovery",
            "be_flags": be_flags,
            "analyze_state_id": state_id,
            "plan_adjustment": plan_adjustment,
            "affected_week_index": current_week_index,
            "daily_result": {
                "plan_id": daily_resp.get("plan_id"),
                "week_index": daily_resp.get("week_index"),
                "week_start": daily_resp.get("week_start"),
                "week_end": daily_resp.get("week_end"),
            },
        }

    # --- 3c) Žiadna zmena – plán vyzerá OK (ale AI sa už zavolalo, lebo BE flagy boli červené) ---
    return {
        "changed": False,
        "mode": "no_adjustment",
        "reason": "plan_adjustment does not request changes",
        "be_flags": be_flags,
        "analyze_state_id": state_id,
        "plan_adjustment": plan_adjustment,
    }