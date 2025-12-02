# Services/coach_athlete_state.py
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone, date

from fastapi import HTTPException

from Services.profile_metrics import service_get_latest_metrics
from Services.profile_static import service_get_static_profile

def _compute_age_from_birth_date(birth_date: Optional[str]) -> Optional[int]:
    """
    birth_date: 'YYYY-MM-DD' alebo ISO 'YYYY-MM-DDTHH:MM:SSZ'
    """
    if not birth_date:
        return None
    try:
        d_str = birth_date[:10]
        year, month, day = map(int, d_str.split("-"))
        b = date(year, month, day)
        today = date.today()
        age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
        return max(age, 0)
    except Exception:
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -------------------- AI USER / RECOVERY z profile_* --------------------


def _build_user_profile_for_ai(
    user_id: int,
    static_row: Optional[Dict[str, Any]],
    metrics_data: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Poskladá 'user' blok pre CoachAnalyzeInput z profile_static + metrics.
    """
    static_row = static_row or {}
    metrics_data = metrics_data or {}

    sex = static_row.get("sex")
    birth_date = static_row.get("birth_date")
    height_cm = static_row.get("height_cm")
    age = _compute_age_from_birth_date(birth_date)

    weight_kg: Optional[float] = None
    m_weight = metrics_data.get("weight_kg")
    if isinstance(m_weight, dict) and m_weight.get("value") is not None:
        try:
            weight_kg = float(m_weight["value"])
        except Exception:
            weight_kg = None

    return {
        "id": user_id,
        "sex": sex,
        "age": age,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "training_age_years": None,  # neskôr vieš doplniť z vlastnej logiky
    }


def _build_recovery_from_metrics(
    metrics_data: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Z latest metrík spraví jednoduchý 'recovery' blok.
    Zatiaľ RHR/HRV nemáme, ale posielame hr_max + vo2max_estimate.
    """
    metrics_data = metrics_data or {}

    hr_max_val = None
    if isinstance(metrics_data.get("HR_max"), dict):
        hr_max_val = metrics_data["HR_max"].get("value")

    vo2_est = None
    if isinstance(metrics_data.get("VO2Max_estimated"), dict):
        vo2_est = metrics_data["VO2Max_estimated"].get("value")

    return {
        "rhr_bpm": None,
        "hrv_avg": None,
        "hrv_trend": None,
        "sleep_ok": None,
        "last_illness_days_ago": None,
        # doplnkové polia pre AI:
        "hr_max": hr_max_val,
        "vo2max_estimate": vo2_est,
    }


# -------------------- INPUT BUILDER --------------------


def _build_base_input(user_id: int) -> Dict[str, Any]:
    """
    Základný stub CoachAnalyzeInput.

    Všetko je nulové/prázdne, FE payload sa doplní až v _merge_fe_*().
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
            # kľúče po športoch – zatiaľ len "run"
            "run": {
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
    }


def _merge_fe_prefs(input_data: Dict[str, Any], fe: Dict[str, Any]) -> None:
    prefs = input_data.setdefault("prefs", {})

    prefs["goal_kind"] = fe.get("goal_kind") or prefs.get("goal_kind")
    prefs["weeks"] = fe.get("weeks") or prefs.get("weeks")
    prefs["plan_start_date"] = (
        fe.get("plan_start_date")
        or fe.get("start_date")
        or prefs.get("plan_start_date")
    )
    prefs["main_sport"] = fe.get("main_sport") or prefs.get("main_sport")
    prefs["secondary_mix"] = (
        fe.get("secondary_mix") or prefs.get("secondary_mix") or []
    )

    # strength settings z FE
    if fe.get("strength_settings") is not None:
        prefs["strength_settings"] = fe["strength_settings"]

    # jednoduchý default: max hard tréningy / týždeň podľa blocks/intensity
    blocks = fe.get("blocks") or {}
    if blocks.get("vo2max") and blocks.get("threshold"):
        hard_max = 3
    elif blocks.get("vo2max") or blocks.get("threshold"):
        hard_max = 2
    else:
        hard_max = 1
    prefs["hard_days_per_week_max"] = hard_max


def _merge_fe_zones(input_data: Dict[str, Any], fe: Dict[str, Any]) -> None:
    """
    Zoberie top-level fe["zones"] (tvoj LTHR model hr_max + Z1–Z5)
    a uloží ho pod zones["run"]["zones"] vo forme zoznamu.
    """
    fe_zones = fe.get("zones")
    if not fe_zones or not isinstance(fe_zones, dict):
        return

    zones = input_data.setdefault("zones", {})
    run_z = zones.setdefault("run", {"lthr_bpm": None, "zones": []})

    hr_max = fe_zones.get("hr_max")
    run_z["hr_max"] = hr_max  # neformálne pole, ale praktické

    out = []
    for name in ["Z1", "Z2", "Z3", "Z4", "Z5"]:
        key = name.lower()
        min_k = f"{key}_min"
        max_k = f"{key}_max"
        v_min = fe_zones.get(min_k)
        v_max = fe_zones.get(max_k)
        if v_min is None and v_max is None:
            continue
        out.append(
            {
                "name": name,
                "hr_min": v_min,
                "hr_max": v_max,
            }
        )

    run_z["zones"] = out


def _merge_fe_thresholds(input_data: Dict[str, Any], fe: Dict[str, Any]) -> None:
    """
    Zoberie top-level fe["thresholds"] (ak existuje) a uloží do thresholds["run"].
    """
    t = fe.get("thresholds")
    if not t or not isinstance(t, dict):
        return

    thresholds = input_data.setdefault("thresholds", {})
    run_t = thresholds.setdefault(
        "run",
        {
            "lthr_bpm": None,
            "pace_lthr_s_per_km": None,
            "ftp_power_w": None,
            "vo2max_estimate": None,
        },
    )

    # FE typ: hr_bpm / pace_sec_km / power_watt / ...
    if t.get("hr_bpm") is not None:
        run_t["lthr_bpm"] = t["hr_bpm"]
    if t.get("pace_sec_km") is not None:
        run_t["pace_lthr_s_per_km"] = t["pace_sec_km"]
    if t.get("power_watt") is not None:
        run_t["ftp_power_w"] = t["power_watt"]


def _merge_fe_bests(input_data: Dict[str, Any], fe: Dict[str, Any]) -> None:
    bests_fe = fe.get("bests")
    if not bests_fe or not isinstance(bests_fe, dict):
        return

    bests = input_data.setdefault("bests", {})
    if "run" in bests_fe:
        bests["run"] = bests_fe["run"]
    if "ride" in bests_fe:
        bests["ride"] = bests_fe["ride"]


def _merge_fe_recent_load(input_data: Dict[str, Any], fe: Dict[str, Any]) -> None:
    rl = fe.get("recent_load")
    if not rl or not isinstance(rl, dict):
        return
    input_data["recent_load"] = rl


def build_input_from_fe_payload(
    user_id: int, fe_payload: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Hlavný builder CoachAnalyzeInput:
      - začneme od čistého stubu
      - ak máme fe_payload, doplníme prefs/zones/thresholds/bests/recent_load
      - zároveň input["fe_payload_raw"] necháme pre debug
    """
    input_data = _build_base_input(user_id)

    if not fe_payload:
        return input_data

    input_data["fe_payload_raw"] = fe_payload

    _merge_fe_prefs(input_data, fe_payload)
    _merge_fe_zones(input_data, fe_payload)
    _merge_fe_thresholds(input_data, fe_payload)
    _merge_fe_bests(input_data, fe_payload)
    _merge_fe_recent_load(input_data, fe_payload)

    return input_data


# -------------------- STATE BUILDER (AI stub) --------------------


def build_state_from_input(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stub generovanie CoachAthleteState z inputu.
    Zatiaľ len jednoduché heuristiky, ale už využíva FE prefs/zones/bests.
    """
    prefs = input_data.get("prefs") or {}
    bests = (input_data.get("bests") or {}).get("run") or []
    recovery = input_data.get("recovery") or {}

    main_sport = prefs.get("main_sport") or "run"
    weeks = prefs.get("weeks") or 4
    goal = prefs.get("goal_kind") or "improve_overall"

    fitness_level_run = 5
    for b in bests:
        dist = b.get("distance_m")
        t = b.get("best_time_s") or b.get("time_s")
        if not dist or not t:
            continue
        if dist == 5000:
            pace = t / 5000.0
            if pace < 0.24:      # ~4:00/km
                fitness_level_run = max(fitness_level_run, 8)
            elif pace < 0.26:    # ~4:20/km
                fitness_level_run = max(fitness_level_run, 7)
            elif pace < 0.28:    # ~4:40/km
                fitness_level_run = max(fitness_level_run, 6)

    block_kind = "base_aerobic"
    if goal in ("race_time", "improve_speed"):
        block_kind = "threshold_speed"
    elif goal == "improve_endurance":
        block_kind = "base_long"

    vo2_est = recovery.get("vo2max_estimate")

    return {
        "schema_version": 1,
        "generated_at": _now_iso(),
        "model": "coach-analyze-stub",
        "user_summary": {
            "headline": "Formálne: stabilná forma, priestor na väčší Z2 objem.",
            "bullets": [
                f"Cieľ: {goal}, horizont ~{weeks} týždňov.",
                f"Hlavný šport: {main_sport}.",
                "PB dáta sú zatiaľ len orientačne zohľadnené (stub heuristika).",
            ],
            "risks": [
                "Riziko rýchleho zvyšovania objemu, ak to preženieš.",
            ],
            "suggestions_short": [
                "Udrž stabilný počet tréningových dní.",
                "Buduj konzistentný Z2 objem.",
                "1–2 kvalitné intenzívne tréningy týždenne zvyčajne stačia.",
            ],
        },
        "ai_state": {
            "fitness_level": {
                "run": {
                    "level_1_to_10": fitness_level_run,
                    "comment": "slušný základ, ale stále je čo ladiť",
                },
                "ride": {
                    "level_1_to_10": 5,
                    "comment": "udržiavacia úroveň",
                },
                "strength": {
                    "level_1_to_10": 5,
                    "comment": "primeraná sila celého tela (stub)",
                },
            },
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {
                "weekly_minutes_min": 180,
                "weekly_minutes_max": 300,
                "note": "zvyšovať objem max ~10–15 % medzi týždňami",
            },
            "intensity_tolerance": {
                "hard_sessions_per_week_max": (
                    input_data.get("prefs", {}).get("hard_days_per_week_max") or 3
                ),
                "comment": "2 hlavné kvalitné tréningy + 1 doplnkový je strop (stub).",
            },
            "suggested_block_kind": block_kind,
            "key_limitations": [
                "inconsistent_long_runs",
            ],
            "key_strengths": [
                "good_general_fitness",
            ],
            "metrics": {
                "estimated_vo2max": vo2_est,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
        },
    }


# -------------------- STORAGE STUB --------------------


def save_state_to_db(user_id: int, state: Dict[str, Any]) -> Optional[int]:
    """
    Stub ukladania – ak už máš implementáciu s DB (tabuľka coach_athlete_state),
    môžeš ju sem nahradiť. Teraz len vrátime 1.
    """
    return 1


# -------------------- PUBLIC SERVICE --------------------


def service_analyze_athlete(
    user_id: int,
    model: str = "coach-analyze-stub",
    save_to_db: bool = True,
    debug: bool = False,
    fe_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia, ktorú volá router.

    - poskladá CoachAnalyzeInput (stub + fe_payload)
    - doplní user + recovery z profile_static + profile_metrics
    - vygeneruje CoachAthleteState (heuristický stub)
    - voliteľne uloží do DB
    """
    # 1) FE → základný input
    input_data = build_input_from_fe_payload(user_id, fe_payload)

    # 2) doplniť user + recovery z profile services
    static_row: Optional[Dict[str, Any]] = None
    metrics_data: Optional[Dict[str, Any]] = None

    # STATIC profil – ak nie je, ignorujeme 404
    try:
        static_row = service_get_static_profile(user_id=user_id)
    except HTTPException as e:
        if e.status_code != 404:
            raise

    # METRICS – latest
    try:
        latest = service_get_latest_metrics(user_id=user_id)
        if isinstance(latest, dict):
            metrics_data = latest.get("data")
    except HTTPException as e:
        if e.status_code != 404:
            raise

    # user blok
    if static_row or metrics_data:
        input_data["user"] = _build_user_profile_for_ai(
            user_id=user_id,
            static_row=static_row,
            metrics_data=metrics_data,
        )

    # recovery blok – aj keď nič nemáš, aspoň tam bude konzistentná štruktúra
    input_data["recovery"] = _build_recovery_from_metrics(metrics_data)

    # 3) AI stub
    state = build_state_from_input(input_data)

    # 4) uloženie
    state_id: Optional[int] = None
    if save_to_db:
        state_id = save_state_to_db(user_id, state)

    if debug:
        print("[coach_athlete_state] debug input:", input_data)  # noqa: T201
        print("[coach_athlete_state] debug state:", state)      # noqa: T201

    return {
        "state_id": state_id,
        "state": state,
        "input": input_data,
        "model": model,
    }