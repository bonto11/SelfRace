# Services/coach_athlete_state.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Services.profile_metrics import service_load_user_profile_for_analysis


# -------------------- LOW-LEVEL HELPERS --------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_base_input(user_id: int) -> Dict[str, Any]:
    """
    Základný tvar CoachAnalyzeInput – všetko prázdne.
    Postupne to budeme dopĺňať z DB (profile, prefs, zones, thresholds, bests, recent_load).
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
                "hr_max": None,
                "lthr_bpm": None,
                "zones": [],  # [{name, hr_min, hr_max}]
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
            # TODO: doplniť z HRV/RHR/sleep metrík, zatiaľ prázdne
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        },
        "active_plan": {
            # TODO: ak neskôr zavedieš tabuľku pre aktívny plán, sem sa to mapne
            "has_active_plan": False,
            "current_week_index": None,
            "total_weeks": None,
            "horizon_days": None,
        },
    }


# -------------------- LOADERY Z DB (SKELETON) --------------------


def _load_prefs_raw_from_db(user_id: int) -> Dict[str, Any]:
    """
    TODO: reálne načítanie coach prefs z tvojej key-value tabuľky (coach.prefs).

    Očakávaný tvar je v podstate to, čo teraz posielal FE → BE, napr.:

    {
      "schema_version": 1,
      "weeks": 4,
      "goal_kind": "improve_overall",
      "plan_start_date": "2025-12-04",
      "primary_sports": ["run","strength"],
      "main_sport": "run",
      "secondary_mix": [...],
      "targets": {...},
      "rules": {...},
      "externals": [...],
      "blocks": {...},
      "strength_settings": {...},
      "coach_voice": "motivator",
      "coach_tone": {...}
    }
    """
    # TODO: implementuj cez vlastnú service / DB handler
    return {}


def _load_zones_raw_from_db(user_id: int) -> Optional[Dict[str, Any]]:
    """
    TODO: načítaj najnovšiu HR zónu pre running z tvojej zones tabuľky.

    Očakávaný tvar niečo ako:

    {
      "sport": "running",
      "hr_max": 207,
      "z1_min": 125, "z1_max": 156,
      "z2_min": 155, "z2_max": 172,
      "z3_min": 171, "z3_max": 179,
      "z4_min": 178, "z4_max": 191,
      "z5_min": 192, "z5_max": 207,
      "created_at": "2025-11-21T12:04:18.529952+00:00"
    }
    """
    # TODO: implementuj reálne načítanie
    return None


def _load_threshold_rows_from_db(user_id: int) -> List[Dict[str, Any]]:
    """
    TODO: načítaj posledné prahy z DB (running LT2 atď).

    Očakávaný tvar riadku:

    {
      "sport": "running",
      "threshold_type": "LT2",
      "hr_bpm": 185,
      "pace_sec_km": 295,
      "power_watt": null,
      "measurement_type": "lab test",
      "updated_at": "2025-11-21T12:04:13.684Z"
    }
    """
    # TODO: implementuj reálne načítanie
    return []


def _load_bests_raw_from_db(user_id: int) -> Dict[str, List[Dict[str, Any]]]:
    """
    TODO: načítaj PB z tvojej PB tabuľky / view.

    Očakávaný tvar pre run:

    {
      "run": [
        {
          "distance_m": 5000,
          "best_time_s": 1393,
          "time_str": "00:23:13",
          "event_name": null,
          "date": "2025-08-04T00:00:00+00:00"
        },
        ...
      ],
      "ride": [...]
    }
    """
    # TODO: implement
    return {"run": [], "ride": []}


def _load_recent_load_raw_from_db(user_id: int) -> Optional[Dict[str, Any]]:
    """
    TODO: načítaj recent_load (weekly summary) – tak ako ho už máš na FE.

    Očakávaný tvar:

    {
      "schema_version": 1,
      "window_days": 42,
      "weeks": [
        {
          "week_start_iso": "...",
          "week_end_iso": "...",
          "week_index_from_now": -1,
          "total_minutes": 190,
          "run_minutes": 102,
          "ride_minutes": 0,
          "strength_sessions": 1,
          "hard_sessions": 1
        },
        ...
      ]
    }
    """
    # TODO: implement
    return None


# -------------------- TRANSFORMÁCIE / ČISTENIE --------------------


def _merge_prefs_from_raw(input_data: Dict[str, Any], raw: Dict[str, Any]) -> None:
    """
    Zoberie raw prefs z DB a namapuje len to, čo naozaj potrebujeme pre AI.
    Nechávame minimálnu cestu.
    """
    if not raw:
        return

    prefs = input_data.setdefault("prefs", {})

    prefs["goal_kind"] = raw.get("goal_kind") or prefs.get("goal_kind")
    prefs["weeks"] = raw.get("weeks") or prefs.get("weeks")
    prefs["plan_start_date"] = (
        raw.get("plan_start_date")
        or raw.get("start_date")
        or prefs.get("plan_start_date")
    )

    prefs["main_sport"] = raw.get("main_sport") or prefs.get("main_sport")

    # secondary_mix – len také, ktoré majú share_pct > 0 a role != "none"
    sec_mix = raw.get("secondary_mix") or []
    cleaned_sec = [
        {
            "sport": s.get("sport"),
            "role": s.get("role"),
            "share_pct": float(s.get("share_pct") or 0),
        }
        for s in sec_mix
        if s.get("sport") and s.get("role") != "none" and float(s.get("share_pct") or 0) > 0
    ]
    prefs["secondary_mix"] = cleaned_sec

    prefs["strength_settings"] = raw.get("strength_settings") or None

    # jednoduchý default na max hard tréningov podľa blocks
    blocks = raw.get("blocks") or {}
    if blocks.get("vo2max") and blocks.get("threshold"):
        hard_max = 3
    elif blocks.get("vo2max") or blocks.get("threshold"):
        hard_max = 2
    else:
        hard_max = 1
    prefs["hard_days_per_week_max"] = hard_max

    # weekly_time_budget_min zatiaľ necháme None – neskôr môžeme dopočítať z recent_load
    prefs["weekly_time_budget_min"] = prefs.get("weekly_time_budget_min")


def _merge_zones_from_raw(input_data: Dict[str, Any], raw: Optional[Dict[str, Any]]) -> None:
    """
    Zoberie najnovšie HR zóny pre running a uloží do input["zones"]["run"].
    Ak nič nemáme, necháme pôvodný prázdny run.zones.
    """
    if not raw:
        return

    zones_root = input_data.setdefault("zones", {})
    run_z = zones_root.setdefault("run", {"hr_max": None, "lthr_bpm": None, "zones": []})

    hr_max = raw.get("hr_max")
    if hr_max is not None:
        run_z["hr_max"] = hr_max

    # Prejdi Z1–Z5 a zober len tie, ktoré majú aspoň nejakú hranicu
    out: List[Dict[str, Any]] = []
    for name in ["Z1", "Z2", "Z3", "Z4", "Z5"]:
        key = name.lower()
        v_min = raw.get(f"{key}_min")
        v_max = raw.get(f"{key}_max")
        if v_min is None and v_max is None:
            continue
        out.append({"name": name, "hr_min": v_min, "hr_max": v_max})

    if out:
        run_z["zones"] = out


def _merge_thresholds_from_rows(
    input_data: Dict[str, Any], rows: List[Dict[str, Any]]
) -> None:
    """
    Zoberie zoznam threshold riadkov z DB a vytiahne hlavne running LT2 pre AI.
    Žiadne bike FTP, ak tam nič nemáme.
    """
    if not rows:
        return

    thr_root = input_data.setdefault("thresholds", {})
    run_thr = thr_root.setdefault(
        "run",
        {
            "lthr_bpm": None,
            "pace_lthr_s_per_km": None,
            "ftp_power_w": None,
            "vo2max_estimate": None,
        },
    )

    # preferuj running + LT2 / HR_LT2 / PACE_LT2
    best = None
    for r in rows:
        sport = str(r.get("sport") or "").lower()
        ttype = str(r.get("threshold_type") or "").upper()
        if sport == "running" and ttype in ("LT2", "HR_LT2", "PACE_LT2"):
            best = r
            break

    if not best:
        # fallback: prvý running riadok
        for r in rows:
            sport = str(r.get("sport") or "").lower()
            if sport == "running":
                best = r
                break

    if not best:
        return

    if best.get("hr_bpm") is not None:
        run_thr["lthr_bpm"] = best["hr_bpm"]
    if best.get("pace_sec_km") is not None:
        run_thr["pace_lthr_s_per_km"] = best["pace_sec_km"]
    # power/FTP zatiaľ ignorujeme – nemáme relevantný model


def _build_bests_block(raw: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Bests minimalizované na to, čo chceš:
      - distance_m
      - time_str (trvanie)
      - date

    best_time_s si kľudne necháme vnútri, lebo ho používame v stub heuristike.
    """
    out = {"run": [], "ride": []}

    run_raw = raw.get("run") or []
    for row in run_raw:
        out["run"].append(
            {
                "distance_m": row.get("distance_m"),
                "time_str": row.get("time_str"),
                "best_time_s": row.get("best_time_s"),
                "date": row.get("date"),
            }
        )

    # ride PB zatiaľ necháme prázdne – ak neskôr pridáš, pofixujeme tu
    return out


def _build_recent_load_block(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Zoberie raw recent_load a z každého týždňa vyhodí polia s nulou (napr. ride_minutes: 0).

    Nechávame vždy:
      - week_start_iso, week_end_iso, week_index_from_now
      - total_minutes
    Všetko ostatné typu *_minutes / *_sessions len keď > 0.
    """
    if not raw:
        return {
            "schema_version": 1,
            "window_days": 42,
            "weeks": [],
        }

    weeks_in: List[Dict[str, Any]] = raw.get("weeks") or []
    weeks_out: List[Dict[str, Any]] = []

    for w in weeks_in:
        base = {
            "week_start_iso": w.get("week_start_iso"),
            "week_end_iso": w.get("week_end_iso"),
            "week_index_from_now": w.get("week_index_from_now"),
            "total_minutes": w.get("total_minutes"),
        }
        for key, val in w.items():
            if key in base:
                continue
            if isinstance(val, (int, float)) and val <= 0:
                continue
            base[key] = val
        weeks_out.append(base)

    return {
        "schema_version": raw.get("schema_version") or 1,
        "window_days": raw.get("window_days") or 42,
        "weeks": weeks_out,
    }


# -------------------- INPUT BUILDER: DB CESTA --------------------


def build_input_from_db(user_id: int) -> Dict[str, Any]:
    """
    Hlavný builder CoachAnalyzeInput – čistá DB cesta.

    - načíta user profil (static + latest weight) → input["user"]
    - načíta coach prefs → input["prefs"]
    - načíta zones + thresholds → input["zones"], input["thresholds"]
    - načíta bests → input["bests"]
    - načíta recent_load → input["recent_load"]
    """
    input_data = _build_base_input(user_id)

        # user profil (static + weight) – priamo z profile_metrics service
    user_prof = service_load_user_profile_for_analysis(user_id=user_id, user_uid=None)
    if user_prof:
        # očakávame: id, sex, age, height_cm, weight_kg
        input_data["user"].update(user_prof)

    # prefs
    raw_prefs = _load_prefs_raw_from_db(user_id)
    _merge_prefs_from_raw(input_data, raw_prefs)

    # zones
    zones_raw = _load_zones_raw_from_db(user_id)
    _merge_zones_from_raw(input_data, zones_raw)

    # thresholds
    thr_rows = _load_threshold_rows_from_db(user_id)
    _merge_thresholds_from_rows(input_data, thr_rows)

    # bests
    bests_raw = _load_bests_raw_from_db(user_id)
    input_data["bests"] = _build_bests_block(bests_raw)

    # recent_load
    recent_raw = _load_recent_load_raw_from_db(user_id)
    input_data["recent_load"] = _build_recent_load_block(recent_raw)

    return input_data


# -------------------- STATE BUILDER (STUB) --------------------


def build_state_from_input(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stub generovanie CoachAthleteState z inputu.
    Zatiaľ len jednoduché heuristiky – hlavne z PB na 5k.
    """
    prefs = input_data.get("prefs") or {}
    bests = (input_data.get("bests") or {}).get("run") or []

    main_sport = prefs.get("main_sport") or "run"
    weeks = prefs.get("weeks") or 4
    goal = prefs.get("goal_kind") or "improve_overall"

    # jednoduché skóre podľa PB na 5k
    fitness_level_run = 5
    for b in bests:
        dist = b.get("distance_m")
        t = b.get("best_time_s")
        if not dist or not t:
            continue
        if dist == 5000:
            pace = t / 5000.0
            if pace < 0.24:  # ~4:00/km
                fitness_level_run = max(fitness_level_run, 8)
            elif pace < 0.26:  # ~4:20/km
                fitness_level_run = max(fitness_level_run, 7)
            elif pace < 0.28:  # ~4:40/km
                fitness_level_run = max(fitness_level_run, 6)

    block_kind = "base_aerobic"
    if goal in ("race_time", "improve_speed"):
        block_kind = "threshold_speed"
    elif goal == "improve_endurance":
        block_kind = "base_long"

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
                    "comment": "udržiavacia úroveň (stub)",
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
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
        },
    }


# -------------------- STORAGE STUB --------------------


def save_state_to_db(user_id: int, state: Dict[str, Any]) -> Optional[int]:
    """
    Stub ukladania – ak už máš implementáciu s DB (coach_athlete_state tabuľka),
    môžeš ju sem nahradiť. Teraz len vrátime 1, aby FE videl state_id.
    """
    # TODO: nahradiť reálnym INSERT/UPSERT do DB
    return 1


# -------------------- PUBLIC SERVICE --------------------


def service_analyze_athlete(
    user_id: int,
    model: str = "coach-analyze-stub",
    save_to_db: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """
    Hlavná service funkcia, ktorú volá router.

    Vždy ide čistá DB cesta – FE neposiela žiadny payload.
    """
    input_data = build_input_from_db(user_id)

    state = build_state_from_input(input_data)

    state_id: Optional[int] = None
    if save_to_db:
        state_id = save_state_to_db(user_id, state)

    if debug:
        print("[coach_athlete_state] debug input:", input_data)  # noqa: T201
        print("[coach_athlete_state] debug state:", state)  # noqa: T201

    return {
        "state_id": state_id,
        "state": state,
        "input": input_data,
        "model": model,
    }