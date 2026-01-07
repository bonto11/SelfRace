# Services/coach_athlete_state.py
from __future__ import annotations
import json
from datetime import datetime, timezone, timedelta
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
from Routes_AI.analyze_athlete_state import generate_athlete_state_json

from Routes_DB.coach_athlete_state import (
    db_insert_athlete_state,
    db_get_state_by_id,
    db_get_latest_state_for_user,
    db_list_states_for_user,
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

    Výstup:
      {
        "soften_next_days": {
          "should_soften": bool,
          "days": int | None,
          "reason": str | None,
        },
        "should_replan_weekly": bool,
        "weekly_replan_reason": str | None,
    }
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
        # weeks sú už zoradené podľa týždňov v raw funkcii → ešte raz zosortujeme pre istotu
        weeks_sorted = sorted(
            weeks,
            key=lambda w: str(w.get("week_start_iso") or ""),
        )
        last_week = weeks_sorted[-1]
        prev_weeks = weeks_sorted[:-1]

        acute_minutes = float(last_week.get("total_minutes") or 0.0)
        # vezmeme max 3 predchádzajúce týždne na "chronic"
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

    # RHR nemáme baseline → zatiaľ len veľmi opatrná heuristika
    if isinstance(rhr, (int, float)) and rhr >= 70:
        # vysoký RHR = možná únava / stres, ale nechceme prepalovať
        soften_days = max(soften_days, 1)
        soften_reasons.append("zvýšený pokojový tep")

    # --- 3) Weekly load spike podľa ACWR ---
    if acwr is not None:
        if acwr >= 1.6:
            # veľký spike → určite zjemniť + zvážiť replan
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
        # posledný týždeň (rovnaká logika ako vyššie)
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

    # beh
    if v.startswith("run") or "run" in v or v in ("trail", "trail_run"):
        return "run"

    # bicykel
    if v.startswith("ride") or v.startswith("cycle") or v.startswith("bike"):
        return "ride"

    # posilka / silový
    if v.startswith("str") or "strength" in v or "gym" in v or "weights" in v:
        return "strength"

    # plávanie
    if "swim" in v:
        return "swim"

    return "other"


def _build_last_activities_block_for_analysis(
    user_id: int,
    *,
    user_jwt: str,
    limit: int = 6,
) -> List[Dict[str, Any]]:
    """
    Vytiahne posledných N aktivít (summary + zóny z enrichment)
    a preloží ich do jednoduchého listu pre AI.

    Formát prvku:
      {
        "activity_id": int,
        "date": "YYYY-MM-DD",
        "sport": "run" | "ride" | "strength" | "swim" | "other",
        "name": str | null,
        "duration_min": float | null,
        "distance_km": float | null,
        "avg_hr": int | null,
        "z1_min": float | null,
        "z2_min": float | null,
        "z3_min": float | null,
        "z4_min": float | null,
        "z5_min": float | null
      }
    """
    jwt = require_jwt(user_jwt)

    if limit <= 0:
        limit = 4

    # chceme posledné N, takže since dáme relatívne ďaleko dozadu (napr. 60 dní)
    since_iso = (
        datetime.now(timezone.utc) - timedelta(days=60)
    ).date().isoformat()

    # 1) ID posledných aktivít
    ids = db_get_recent_activity_ids(
        user_id=user_id,
        since_iso_date=since_iso,
        limit=limit,
        user_jwt=jwt,
    )
    if not ids:
        return []

    # 2) summary pre tieto aktivity
    summary_rows = db_get_summary_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=jwt,
    ) or []

    if not summary_rows:
        return []

    # 3) enrichment – zóny pre tieto aktivity
    enr_rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=jwt,
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

    # id-čka berieme ako set, ale summary_rows už obsahujú len tie, ktoré existujú v summary
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
) -> Dict[str, Any]:
    """
    Poskladá CoachAnalyzeInput z DB.

    - vyžaduje user_jwt → všetky user-data služby idú cez RLS/JWT
    """
    jwt = require_jwt(user_jwt)

    input_data = _build_base_input(user_id)

    # 1) PROFIL
    input_data["user"] = service_load_user_profile_for_analysis(
        user_id=user_id,
        user_uid=None,
        user_jwt=jwt,
    )

    # 2) ZONES
    input_data["zones"] = service_build_zones_block_for_analysis(
        user_id,
        user_jwt=jwt,
    )

    # 3) THRESHOLDS
    input_data["thresholds"] = service_build_thresholds_block_for_analysis(
        user_id,
        user_jwt=jwt,
    )

    # 4) PREFS
    input_data["prefs"] = service_load_coach_prefs_for_analysis(
        user_id,
        user_jwt=jwt,
    )

    # 5) BESTS
    input_data["bests"] = service_build_bests_block_for_analysis(
        user_id,
        user_jwt=jwt,
    )

    # 6) RECENT LOAD
    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id,
        window_days=42,
        user_jwt=jwt,
    )

    # 7) RECOVERY
    input_data["recovery"] = service_build_recovery_block_for_analysis(
        user_id,
        user_jwt=jwt,
    )

    # 8) ACTIVE PLAN
    input_data["active_plan"] = service_build_active_plan_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
    )

    # 9) EXTERNAL EVENTS – už z coach_external_events service
    input_data["external_events"] = service_build_external_events_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
    )

    # 10) LAST ACTIVITIES – nové: posledné reálne tréningy (beh + ostatné)
    input_data["last_activities"] = _build_last_activities_block_for_analysis(
        user_id=user_id,
        user_jwt=jwt,
        limit=6,  # pokojne zmeníme na 4, ak chceš menší context
    )

    return input_data


# -------------------- STORAGE --------------------


def service_save_state_to_db(
    user_id: int,
    analysis: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> Optional[int]:
    """
    Uloží AI stav atleta do coach_athlete_state pod user JWT (RLS).
    """
    jwt = require_jwt(user_jwt)

    model = str(analysis.get("model") or "Trainalyze Coach")
    version = int(analysis.get("schema_version") or 1)
    return db_insert_athlete_state(
        user_id=user_id,
        model=model,
        state_json=analysis,
        version=version,
        user_jwt=jwt,
    )


def service_get_athlete_state_by_id(
    state_id: int,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny záznam z coach_athlete_state podľa id
    a rozbalí state_json do samostatného kľúča "state".
    """
    jwt = require_jwt(user_jwt)

    row = db_get_state_by_id(state_id, user_jwt=jwt)
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
    }


def service_get_latest_athlete_state(
    user_id: int,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší stav pre usera (podľa created_at DESC).
    """
    jwt = require_jwt(user_jwt)

    row = db_get_latest_state_for_user(
        user_id=user_id,
        version=version,
        user_jwt=jwt,
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
    }


def service_list_athlete_states_meta(
    user_id: int,
    limit: int = 20,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    História stavov – len meta info (bez state_json),
    vhodné na výpis v UI / debug.
    """
    jwt = require_jwt(user_jwt)

    rows = db_list_states_for_user(
        user_id=user_id,
        limit=limit,
        user_jwt=jwt,
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
    debug: bool = False,
    save_to_db: bool = True,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia pre AI analýzu atleta.

    - poskladá CoachAnalyzeInput z DB (RLS, require JWT)
    - zavolá OpenAI cez generate_athlete_state_json
    - doplní deterministic plan_adjustment podľa recent_load + recovery
    - (voliteľne) uloží analýzu do DB
    - vráti štruktúru vhodnú pre FE aj pre ďalší backend (plan-weekly/daily)
    """
    jwt = require_jwt(user_jwt)

    # 1) INPUT
    input_data = build_input_from_db(user_id, user_jwt=jwt)

    # 1b) Kontext pre AI – deep copy + drop external_activities z prefs (ak sú)
    context_for_ai = json.loads(json.dumps(input_data, default=str))
    try:
        prefs_block = context_for_ai.get("prefs") or {}
        if isinstance(prefs_block, dict):
            prefs_val = prefs_block.get("value")
            if isinstance(prefs_val, dict):
                prefs_val.pop("external_activities", None)
    except Exception:
        # nech analyze nespadne kvôli blbosti v prefse
        pass

    # 2) AI CALL – čistý výstup z AI = "analysis"
    model_to_use = model or DEFAULT_MODEL
    analysis, trace = generate_athlete_state_json(
        context_payload=input_data,  # používame pôvodný input_data
        model=model_to_use,
    )

    if not isinstance(analysis, dict):
        analysis = {}

    # doplníme meta, ak by ich AI neposlala
    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())
    analysis.setdefault("model", "Coach BeTY")

    # 2b) Doplníme deterministic plan_adjustment podľa našich heuristík
    try:
        signals = _compute_plan_adjustment_signals(
            analyze_input=input_data,
            analysis=analysis,
        )
    except Exception as e:
        # nech analyza nespadne na heuristike – v najhoršom žiadne auto úpravy
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

    # 3) STORAGE (voliteľné)
    state_id: Optional[int] = None
    if save_to_db:
        state_id = service_save_state_to_db(
            user_id=user_id,
            analysis=analysis,
            user_jwt=jwt,
        )

    # 4) RESPONSE – jasné oddelenie INPUT vs AI OUTPUT
    resp: Dict[str, Any] = {
        "state_id": state_id,
        "model": model_to_use,
        "analysis": analysis,  # čistý výstup + naše plan_adjustment
        "input": input_data,   # CoachAnalyzeInput snapshot
    }
    if debug:
        resp["debug_trace"] = trace

    return resp