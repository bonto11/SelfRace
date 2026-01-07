from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, Optional, List
from statistics import mean

from Services.profile_metrics import service_load_user_profile_for_analysis
from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_bests import service_build_bests_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.analytics_RecentLoad import (
    service_build_recent_load_block_for_analysis,
)
from Services.coach_external_events import (
    service_build_external_events_block_for_analysis,
)
from Services.coach_plan_meta import service_build_active_plan_block_for_analysis
from Routes_AI.analyze_athlete_state import (
    generate_athlete_state_json,
    generate_athlete_progress_report,
)

from Routes_DB.coach_athlete_state import (
    db_insert_athlete_state,
    db_get_state_by_id,
    db_get_latest_state_for_user,
    db_get_latest_states_for_user,
    db_list_states_for_user,
    db_update_state_compare_previous,
)
from Routes_DB.activities_summary import (
    db_get_recent_activity_ids,
    db_get_summary_for_activities,
)
from Routes_DB.activities_enrichment import (
    db_get_enrichment_for_activities,
)
from Services.users import require_jwt

from Configs.config import DEFAULT_MODEL


# -------------------- HELPERS --------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_base_input(user_id: int) -> Dict[str, Any]:
    """
    Základný CoachAnalyzeInput skeleton.
    Reálne hodnoty sa doplnia z jednotlivých service_*_for_analysis.
    """
    return {
        "schema_version": 1,
        "user": {
            "id": user_id,
            "sex": None,
            "age": None,
            "height_cm": None,
            "weight_kg": None,
            "training_age_years": None,
        },
        "prefs": {
            "goal_kind": None,
            "weeks": None,
            "plan_start_date": None,
            "main_sport": None,
            "secondary_mix": [],
            "strength_settings": None,
            "weekly_time_budget_min": None,
            "hard_days_per_week_max": None,
            "notes_for_coach": None,
        },
        "zones": {
            "run": {
                "hr_max": None,
                "lthr_bpm": None,
                "zones": [],
            }
        },
        "thresholds": {
            "run": {
                "lthr_bpm": None,
                "pace_lthr_s_per_km": None,
                "ftp_power_w": None,
                "vo2max_estimate": None,
            }
        },
        "bests": {
            "run": [],
            "ride": [],
        },
        "recent_load": {
            "schema_version": 1,
            "window_days": 42,
            "weeks": [],
        },
        "recovery": {
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        },
        "active_plan": {
            "has_active_plan": False,
            "current_week_index": None,
            "total_weeks": None,
            "horizon_days": None,
        },
        # external_events doplníme neskôr
        "external_events": None,
        # nové – posledné konkrétne tréningy, aby AI videla reálne správanie
        "last_activities": [],
    }


def _compute_plan_adjustment_signals(
    analyze_input: Dict[str, Any],
    analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Heuristika pre plan_adjustment.

    Vstup:
      - analyze_input: CoachAnalyzeInput (profil, recent_load, recovery, ...)
      - analysis: AI výstup z analyze_athlete_state (ai_state obsahuje tolerancie)
    """
    recent_load = analyze_input.get("recent_load") or {}
    recovery = analyze_input.get("recovery") or {}
    weeks = recent_load.get("weeks") or []

    soften_days: int = 0
    soften_reasons: List[str] = []
    should_replan_weekly: bool = False
    weekly_replan_reason: Optional[str] = None

    # --- 1) Weekly load: acute vs chronic (ACWR) ---
    acute_minutes: Optional[float] = None
    chronic_minutes: Optional[float] = None
    acwr: Optional[float] = None

    if isinstance(weeks, list) and len(weeks) >= 2:
        weeks_sorted = sorted(
            weeks,
            key=lambda w: str(w.get("week_start_iso") or ""),
        )
        last_week = weeks_sorted[-1]
        prev_weeks = weeks_sorted[:-1]

        acute_minutes = float(last_week.get("total_minutes") or 0.0)

        prev_tail = prev_weeks[-3:]
        prev_vals = [
            float(w.get("total_minutes") or 0.0)
            for w in prev_tail
            if isinstance(w.get("total_minutes"), (int, float))
        ]
        prev_vals = [v for v in prev_vals if v > 0]

        if prev_vals:
            chronic_minutes = mean(prev_vals)
            if chronic_minutes > 0:
                acwr = acute_minutes / chronic_minutes

    # --- 2) Recovery: HRV trend, RHR, spánok ---
    rhr = recovery.get("rhr_bpm")
    hrv_avg = recovery.get("hrv_avg")
    hrv_trend = recovery.get("hrv_trend")  # "up" | "down" | "stable" | None
    sleep_ok = recovery.get("sleep_ok")  # True/False/None

    if hrv_trend == "down" and isinstance(hrv_avg, (int, float)):
        soften_days = max(soften_days, 2)
        soften_reasons.append("HRV trend je smerom nadol")

    if sleep_ok is False:
        soften_days = max(soften_days, 1)
        soften_reasons.append("nedostatočný spánok")

    if isinstance(rhr, (int, float)) and rhr >= 70:
        soften_days = max(soften_days, 1)
        soften_reasons.append("zvýšený pokojový tep")

    # --- 3) Weekly load spike podľa ACWR ---
    if acwr is not None:
        if acwr >= 1.6:
            soften_days = max(soften_days, 3)
            soften_reasons.append(
                "prudký nárast týždennej záťaže (viac než ~60 % nad priemerom)"
            )
            should_replan_weekly = True
            weekly_replan_reason = (
                weekly_replan_reason
                or "prudký nárast týždennej záťaže, odporúčaná úprava týždenného plánu"
            )
        elif acwr >= 1.4:
            soften_days = max(soften_days, 2)
            soften_reasons.append(
                "výrazný nárast týždennej záťaže (okolo ~40 % nad priemerom)"
            )

    # --- 4) Hard sessions vs. AI tolerancia ---
    ai_state = analysis.get("ai_state") or {}
    intensity_tol = ai_state.get("intensity_tolerance") or {}
    hard_max = intensity_tol.get("hard_sessions_per_week_max")

    last_week_hard_sessions: Optional[int] = None
    if isinstance(weeks, list) and weeks:
        weeks_sorted2 = sorted(
            weeks, key=lambda w: str(w.get("week_start_iso") or "")
        )
        last_w = weeks_sorted2[-1]
        hs = last_w.get("hard_sessions")
        if isinstance(hs, int):
            last_week_hard_sessions = hs

    if isinstance(hard_max, (int, float)) and isinstance(last_week_hard_sessions, int):
        if last_week_hard_sessions > hard_max + 1:
            soften_days = max(soften_days, 2)
            soften_reasons.append(
                "bolo viac náročných tréningov, než odporúča intenzitná tolerancia"
            )
            if acwr is not None and acwr >= 1.3 and not should_replan_weekly:
                should_replan_weekly = True
                weekly_replan_reason = (
                    weekly_replan_reason
                    or "kombinácia príliš veľa ťažkých tréningov a zvýšenej záťaže"
                )

    # --- 5) Kombinácia: únavové signály + load spike ---
    if (
        (hrv_trend == "down" or sleep_ok is False)
        and acwr is not None
        and acwr >= 1.3
        and not should_replan_weekly
    ):
        should_replan_weekly = True
        weekly_replan_reason = (
            weekly_replan_reason
            or "zhoršená regenerácia a zvýšená záťaž, odporúčaná úprava týždenného plánu"
        )

    should_soften = soften_days > 0
    soften_reason_text = "; ".join(soften_reasons) if soften_reasons else None

    return {
        "soften_next_days": {
            "should_soften": should_soften,
            "days": soften_days if should_soften else None,
            "reason": soften_reason_text,
        },
        "should_replan_weekly": bool(should_replan_weekly),
        "weekly_replan_reason": weekly_replan_reason,
    }


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None


def _to_int(x: Any) -> Optional[int]:
    try:
        if x is None or x == "":
            return None
        return int(x)
    except Exception:
        return None


def _canonical_sport(s: Any) -> str:
    """
    Z DB labelu spraví jednoduchý sport code pre AI: run/ride/strength/swim/other.
    """
    if not s:
        return "other"
    v = str(s).lower()

    if v.startswith("run") or "run" in v or v in ("trail", "trail_run"):
        return "run"

    if v.startswith("ride") or v.startswith("cycle") or v.startswith("bike"):
        return "ride"

    if v.startswith("str") or "strength" in v or "gym" in v or "weights" in v:
        return "strength"

    if "swim" in v:
        return "swim"

    return "other"


def _build_last_activities_block_for_analysis(
    user_id: int,
    *,
    user_jwt: Optional[str],
    service: bool = False,
    limit: int = 6,
) -> List[Dict[str, Any]]:
    """
    Vytiahne posledných N aktivít (summary + zóny z enrichment)
    a preloží ich do jednoduchého listu pre AI.

    - service=False → RLS klient (require_jwt),
    - service=True  → service klient (DB vrstva podľa `service=True`).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    if limit <= 0:
        limit = 4

    since_iso = (
        datetime.now(timezone.utc) - timedelta(days=60)
    ).date().isoformat()

    # 1) ID posledných aktivít
    ids = db_get_recent_activity_ids(
        user_id=user_id,
        since_iso_date=since_iso,
        limit=limit,
        user_jwt=jwt,
        service=service,
    )
    if not ids:
        return []

    # 2) summary pre tieto aktivity
    summary_rows = db_get_summary_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=jwt,
        service=service,
    ) or []

    if not summary_rows:
        return []

    # 3) enrichment – zóny pre tieto aktivity
    enr_rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=jwt,
        service=service,
    ) or []
    enr_by_id: Dict[int, Dict[str, Any]] = {}
    for r in enr_rows:
        aid = _to_int(r.get("activity_id"))
        if aid is not None:
            enr_by_id[aid] = r

    # 4) poskladáme výsledný list – zoradený podľa date desc
    def _date_key(row: Dict[str, Any]) -> str:
        return str(row.get("date") or "")[:19]

    out: List[Dict[str, Any]] = []

    for r in sorted(summary_rows, key=_date_key, reverse=True):
        aid = _to_int(r.get("activity_id"))
        if aid is None:
            continue

        dt_raw = str(r.get("date") or "")
        date_str = dt_raw[:10] if dt_raw else None

        moving_s = _to_float(r.get("moving_time_s"))
        dist_m = _to_float(r.get("distance_m"))
        avg_hr = _to_int(r.get("average_heartrate_bpm"))

        dur_min = moving_s / 60.0 if moving_s and moving_s > 0 else None
        dist_km = dist_m / 1000.0 if dist_m and dist_m > 0 else None

        sport_src = r.get("sport_type_fe") or r.get("sport_type")
        sport = _canonical_sport(sport_src)

        enr = enr_by_id.get(aid, {})

        out.append(
            {
                "activity_id": aid,
                "date": date_str,
                "sport": sport,
                "name": r.get("name"),
                "duration_min": dur_min,
                "distance_km": dist_km,
                "avg_hr": avg_hr,
                "z1_min": _to_float(enr.get("z1_min")),
                "z2_min": _to_float(enr.get("z2_min")),
                "z3_min": _to_float(enr.get("z3_min")),
                "z4_min": _to_float(enr.get("z4_min")),
                "z5_min": _to_float(enr.get("z5_min")),
            }
        )

    return out


# -------------------- INPUT BUILDER: DB → CoachAnalyzeInput --------------------


def build_input_from_db(
    user_id: int,
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Poskladá CoachAnalyzeInput z DB.

    - ak service=False → všetko ide cez RLS (vyžaduje user_jwt),
    - ak service=True  → používa sa service klient (user_jwt sa len forwarduje).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    input_data = _build_base_input(user_id)

    # 1) PROFIL
    input_data["user"] = service_load_user_profile_for_analysis(
        user_id=user_id,
        user_uid=None,
        user_jwt=jwt,
        service=service,
    )

    # 2) ZONES
    input_data["zones"] = service_build_zones_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 3) THRESHOLDS
    input_data["thresholds"] = service_build_thresholds_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 4) PREFS
    input_data["prefs"] = service_load_coach_prefs_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 5) BESTS
    input_data["bests"] = service_build_bests_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 6) RECENT LOAD
    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=42,
        user_jwt=jwt,
        service=service,
    )

    # 7) RECOVERY
    input_data["recovery"] = service_build_recovery_block_for_analysis(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    # 8) ACTIVE PLAN
    input_data["active_plan"] = service_build_active_plan_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # 9) EXTERNAL EVENTS
    input_data["external_events"] = service_build_external_events_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # 10) LAST ACTIVITIES
    input_data["last_activities"] = _build_last_activities_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
        limit=6,
    )

    return input_data


# -------------------- STORAGE --------------------


def service_save_state_to_db(
    user_id: int,
    analysis: Dict[str, Any],
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
) -> Optional[int]:
    """
    Uloží AI stav atleta do coach_athlete_state.

    - RLS režim:  service=False → vyžaduje user_jwt,
    - service režim: service=True → použije service klienta (user_jwt ignoruje).
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    model = str(analysis.get("model") or "Trainalyze Coach")
    version = int(analysis.get("schema_version") or 1)
    return db_insert_athlete_state(
        user_id=user_id,
        model=model,
        state_json=analysis,
        version=version,
        user_jwt=jwt,
        service=service,
    )


def service_get_athlete_state_by_id(
    state_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny záznam z coach_athlete_state podľa id
    a rozbalí state_json do samostatného kľúča "state".
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_state_by_id(
        state_id,
        user_jwt=jwt,
        service=service,
    )
    if not row:
        return None

    state_json = row.get("state_json") or {}

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
        "compare_previous": row.get("compare_previous"),
    }


def service_get_latest_athlete_state(
    user_id: int,
    version: Optional[int] = 1,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší stav pre usera (podľa created_at DESC).
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_latest_state_for_user(
        user_id=user_id,
        version=version,
        user_jwt=jwt,
        service=service,
    )
    if not row:
        return None

    state_json = row.get("state_json") or {}

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
        "compare_previous": row.get("compare_previous"),
    }


def service_list_athlete_states_meta(
    user_id: int,
    limit: int = 20,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    História stavov – len meta info (bez state_json),
    vhodné na výpis v UI / debug.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    rows = db_list_states_for_user(
        user_id=user_id,
        limit=limit,
        user_jwt=jwt,
        service=service,
    )
    return [
        {
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "model": r.get("model"),
            "version": r.get("version"),
            "created_at": r.get("created_at"),
        }
        for r in rows or []
    ]


# -------------------- PUBLIC SERVICE: DB → AI → DB/FE --------------------


def service_analyze_athlete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    debug: bool = False,
    save_to_db: bool = True,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia pre AI analýzu atleta.

    - RLS režim (FE):               service=False + user_jwt → všetko ide cez RLS.
    - SERVICE režim (cron/webhook): service=True  + user_jwt=None → používa sa service klient.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    # 1) INPUT
    input_data = build_input_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    # 1b) Kontext pre AI – deep copy + drop external_activities z prefs (ak sú)
    context_for_ai = json.loads(json.dumps(input_data, default=str))
    try:
        prefs_block = context_for_ai.get("prefs") or {}
        # ak sú prefs zabalene ako {"value": {...}}, rieš to tam
        if isinstance(prefs_block, dict):
            # varianta 1: prefs.value.external_activities
            prefs_val = prefs_block.get("value")
            if isinstance(prefs_val, dict):
                prefs_val.pop("external_activities", None)
            # varianta 2: priamo prefs.external_activities
            prefs_block.pop("external_activities", None)
    except Exception:
        pass

    # 2) AI CALL – čistý výstup z AI = "analysis"
    model_to_use = model or DEFAULT_MODEL
    analysis, trace = generate_athlete_state_json(
        context_payload=context_for_ai,
        model=model_to_use,
    )

    if not isinstance(analysis, dict):
        analysis = {}

    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())
    analysis.setdefault("model", "Coach BeTY")

    # 2b) deterministic plan_adjustment z našich heuristík
    try:
        signals = _compute_plan_adjustment_signals(
            analyze_input=input_data,
            analysis=analysis,
        )
    except Exception as e:
        print("[service_analyze_athlete] plan_adjustment error:", repr(e))
        signals = {
            "soften_next_days": {
                "should_soften": False,
                "days": None,
                "reason": None,
            },
            "should_replan_weekly": False,
            "weekly_replan_reason": None,
        }

    ai_state = analysis.setdefault("ai_state", {})
    ai_state["plan_adjustment"] = {
        "soften_next_days": {
            "should_soften": bool(
                (signals.get("soften_next_days") or {}).get("should_soften")
            ),
            "days": (signals.get("soften_next_days") or {}).get("days"),
            "reason": (signals.get("soften_next_days") or {}).get("reason"),
        },
        "should_replan_weekly": bool(signals.get("should_replan_weekly")),
        "weekly_replan_reason": signals.get("weekly_replan_reason"),
    }

    # 3) STORAGE + progress report
    state_id: Optional[int] = None
    compare_previous: Optional[Dict[str, Any]] = None

    if save_to_db:
        state_id = service_save_state_to_db(
            user_id=user_id,
            analysis=analysis,
            user_jwt=jwt,
            service=service,
        )

        # ak máme aspoň 2 stavy, dopočítaj progress report a ulož do compare_previous
        try:
            progress_result = service_compare_latest_athlete_states(
                user_id=user_id,
                version=analysis.get("schema_version") or 1,
                user_jwt=user_jwt if not service else None,
                service=service,
                model=model_to_use,
                debug=False,
            )
            if progress_result.get("ok") and progress_result.get("report"):
                compare_previous = progress_result.get("report")
        except Exception as e:  # noqa: BLE001
            print("[service_analyze_athlete] compare_previous error:", repr(e))

    resp: Dict[str, Any] = {
        "state_id": state_id,
        "model": model_to_use,
        "analysis": analysis,
        "input": input_data,
    }
    if compare_previous is not None:
        resp["compare_previous"] = compare_previous
    if debug:
        resp["debug_trace"] = trace

    return resp


def service_compare_latest_athlete_states(
    user_id: int,
    *,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
    model: Optional[str] = None,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Zoberie posledné dva uložené stavy atleta a spraví AI progress report.
    Report sa zároveň uloží do compare_previous na najnovšom state.
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    # 1) posledné 2 stavy vrátane state_json
    rows = db_get_latest_states_for_user(
        user_id=user_id,
        limit=2,
        version=version,
        user_jwt=jwt,
        service=service,
    )

    if len(rows) < 2:
        return {
            "ok": False,
            "error": "not_enough_states",
            "message": "Na porovnanie sú potrebné aspoň dve AI analýzy.",
            "user_id": user_id,
        }

    current = rows[0]
    previous = rows[1]

    current_state = current.get("state_json") or {}
    previous_state = previous.get("state_json") or {}

    model_to_use = model or DEFAULT_MODEL

    # 2) AI report
    report, trace = generate_athlete_progress_report(
        previous_state=previous_state,
        current_state=current_state,
        model=model_to_use,
        user_id=user_id,
        debug_raw=debug,
    )

    # 3) uložíme report do compare_previous na aktuálnom zázname
    try:
        sid_raw = current.get("id")
        sid: Optional[int]
        if isinstance(sid_raw, int):
            sid = sid_raw
        elif isinstance(sid_raw, str):
            try:
                sid = int(sid_raw)
            except Exception:
                sid = None
        else:
            sid = None

        if sid is not None:
            db_update_state_compare_previous(
                state_id=sid,
                compare_previous=report,
                user_jwt=jwt,
                service=service,
            )
    except Exception as e:  # noqa: BLE001
        print(
            "[service_compare_latest_athlete_states] db_update_state_compare_previous error:",
            repr(e),
        )

    resp: Dict[str, Any] = {
        "ok": True,
        "user_id": user_id,
        "version": version,
        "current_state_id": current.get("id"),
        "previous_state_id": previous.get("id"),
        "current_created_at": current.get("created_at"),
        "previous_created_at": previous.get("created_at"),
        "report": report,
        "source": "generated",
    }
    if debug:
        resp["debug_trace"] = trace

    return resp

def service_get_latest_athlete_progress(
    user_id: int,
    version: Optional[int] = 1,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Vráti posledný stav atleta so zhrnutím progressu (compare_previous).

    - RLS režim (FE):               service=False + user_jwt
    - SERVICE režim (cron/worker):  service=True  + user_jwt=None
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_latest_state_for_user(
        user_id=user_id,
        version=version,
        user_jwt=jwt,
        service=service,
    )
    if not row:
        return None

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        # tu je uložený AI weekly progress report
        "compare_previous": row.get("compare_previous"),
    }