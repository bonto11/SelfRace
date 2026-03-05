# ===== Services/AI/daily_builders.py =====
from __future__ import annotations

import copy  # <-- Pridané pre bezpečné kopírovanie slovníka
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_DB.coach_plan_weekly import db_get_week_row_for_plan
from Routes_DB.users_pace_history import db_get_latest_paces  # NEW: Načítanie temp z DB
from Services.AI.athlete_state_builders import build_input_from_db
from Services.coach_external_events import service_list_external_events_window
from Services.coach_strength_mapper import prepare_strength_context_for_ai # NEW
from Modules.Supabase.auth import AuthCtx
from Configs.config import WEEKDAY_TO_ABBR


_ALLOWED_SESSION_SPORTS = {"run", "ride", "strength", "swim", "other"}
_ALLOWED_EXTERNAL_INTENSITIES = {"hard", "medium", "easy"}


def _safe_int(
    v: Any, default: int, *, min_v: Optional[int] = None, max_v: Optional[int] = None
) -> int:
    try:
        if v is None: out = default
        elif isinstance(v, (int, float)): out = int(v)
        elif isinstance(v, str):
            s = v.strip()
            out = int(float(s)) if s else default
        else: out = int(v)
    except Exception:
        out = default

    if min_v is not None and out < min_v: out = min_v
    if max_v is not None and out > max_v: out = max_v
    return out


def _weekday_abbr_from_iso(d: str) -> Optional[str]:
    if not isinstance(d, str) or not d: return None
    try:
        dd = date.fromisoformat(d[:10])
        return WEEKDAY_TO_ABBR.get(dd.weekday())
    except Exception: return None


def _weekday_abbr_from_int(v: Any) -> Optional[str]:
    try: n = int(v)
    except Exception: return None
    return {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"}.get(n)


def _coerce_session_sport(raw_sport: Any) -> str:
    s = str(raw_sport or "").strip().lower()
    if s in _ALLOWED_SESSION_SPORTS: return s
    if s in {"bike", "cycling", "bicycle"}: return "ride"
    if s in {"run", "running"}: return "run"
    if s in {"gym", "weights", "weightlifting"}: return "strength"
    if s in {"swim", "swimming"}: return "swim"
    return "other"


def _normalize_external_intensity(v: Any) -> Optional[str]:
    s = str(v or "").strip().lower()
    if not s: return None
    if s in {"high", "very_hard", "vhard", "hard"}: return "hard"
    if s in {"moderate", "mod", "mid", "medium"}: return "medium"
    if s in {"low", "easy", "light"}: return "easy"
    return s if s in _ALLOWED_EXTERNAL_INTENSITIES else None


def build_daily_rows_from_ai(
    user_id: int,
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []

    if not isinstance(days, list): return rows

    for day in days:
        if not isinstance(day, dict): continue

        date_str = day.get("date")
        sessions = day.get("sessions") or []
        if not isinstance(date_str, str) or not date_str: continue
        if not isinstance(sessions, list): continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict): continue

            sport_safe = _coerce_session_sport(s.get("sport") or "other")

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str[:10],
                "sport": sport_safe,
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": "ai_daily_v2",
                "session_type": s.get("session_type"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            }
            rows.append(row)
    return rows


def flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    raw = analyze_input.get("prefs") or {}
    
    # Pridané bezpečné skopírovanie, aby sme nemenili originál v analyze_input
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        result = copy.deepcopy(raw["value"])
    else:
        result = copy.deepcopy(raw) if isinstance(raw, dict) else {}
        
    # ✅ Vymazanie use_zones z preferences, aby to AI nevidela
    if "preferences" in result and isinstance(result["preferences"], dict):
        result["preferences"].pop("use_zones", None)
        
    return result


def extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def _two_a_day_cap_from_prefs(prefs: Dict[str, Any]) -> int:
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict): return 0
    two = pref_obj.get("two_a_day") or {}
    if not isinstance(two, dict) or not bool(two.get("enabled")): return 0
    return _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2)


def _long_run_days_from_prefs(prefs: Dict[str, Any]) -> List[str]:
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict): return []
    days = pref_obj.get("long_run_days") or []
    if not isinstance(days, list): return []
    return [d.strip() for d in days if isinstance(d, str) and d.strip()]


def _strength_sessions_target_from_prefs(prefs: Dict[str, Any]) -> Optional[int]:
    strength_settings = prefs.get("strength_settings")
    if isinstance(strength_settings, dict):
        raw = strength_settings.get("sessions_per_week")
        if isinstance(raw, (int, float, str)):
            try: return int(raw)
            except Exception: return None

    # Fallback to legacy
    targets = prefs.get("targets")
    legacy = ((targets.get("strength") or {}).get("sessions_per_week") if isinstance(targets, dict) else None)
    if isinstance(legacy, (int, float, str)):
        try: return int(legacy)
        except Exception: return None

    return None


def _normalize_external_occurrences_from_service(ext_window: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not isinstance(ext_window, dict): return []
    raw_list: Any = ext_window.get("occurrences") or ext_window.get("events")
    if not isinstance(raw_list, list):
        win = ext_window.get("window")
        if isinstance(win, dict): raw_list = win.get("events")
    
    if not isinstance(raw_list, list): return []

    out: List[Dict[str, Any]] = []
    for e in raw_list:
        if not isinstance(e, dict): continue
        occ_date = (e.get("occurrence_date") or e.get("date") or e.get("start_date_local") or e.get("start_date"))
        if not isinstance(occ_date, str) or not occ_date: continue

        ds = occ_date[:10]
        wd = _weekday_abbr_from_int(e.get("occurrence_weekday_int")) or \
             (e.get("occurrence_weekday") if isinstance(e.get("occurrence_weekday"), str) else None) or \
             _weekday_abbr_from_iso(ds)
        if not wd: continue

        sport_raw = e.get("sport") or e.get("sport_raw")
        
        # ✅ OPRAVA: Uložíme do premennej, aby linter chápal typovú kontrolu
        raw_dur = e.get("duration_min")
        dur_int = int(raw_dur) if isinstance(raw_dur, (int, float)) else None
        
        out.append({
            "date": ds,
            "weekday": wd,
            "sport_raw": sport_raw,
            "session_sport": _coerce_session_sport(sport_raw),
            "title": e.get("title") or "Externá aktivita",
            "duration_min": dur_int,
            "priority": e.get("priority") or "optional",
            "start_time_local": e.get("start_time_local"),
            "notes": e.get("notes"),
            "source": "external_events",
            "intensity": _normalize_external_intensity(e.get("intensity")),
            "allow_other_training": e.get("allow_other_training"),
        })
    return out


def _build_external_block(occurrences: List[Dict[str, Any]], week_start: Any, week_end: Any) -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "occurrences": occurrences,
        "window": {"from": week_start, "to": week_end},
    }

# ✅ Helper na zistenie, či je user začiatočník/navrátilec
def _check_is_returning_beginner(analyze_input: Dict[str, Any]) -> bool:
    last_activities = analyze_input.get("last_activities") or []
    if not last_activities:
        return True # Žiadna história = začiatočník
    
    # Nájdeme najnovšiu aktivitu
    latest_date_str = None
    for act in last_activities:
        d = act.get("start_date_local") or act.get("start_date") or act.get("date")
        if d:
            if latest_date_str is None or d > latest_date_str:
                latest_date_str = d
    
    if not latest_date_str:
        return True

    # Ak je posledná aktivita staršia ako 6 týždňov (42 dní), považujeme ho za začiatočníka
    try:
        latest_dt = date.fromisoformat(latest_date_str[:10])
        diff = (date.today() - latest_dt).days
        if diff > 42:
            return True
    except Exception:
        pass
        
    return False

def build_daily_context_from_db(
    user_id: int,
    *,
    week_index: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    

    # 2) analyze input
    analyze_input = build_input_from_db(user_id=user_id, ctx=ctx) or {}
    
    # Funkcia teraz urobí deepcopy a natvrdo vymaže "use_zones"
    prefs_ai = flatten_prefs_for_ai(analyze_input)
    targets_ai = extract_targets_from_prefs(prefs_ai)

    # Zistíme status začiatočníka
    is_returning_beginner = _check_is_returning_beginner(analyze_input)

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

    # NEW: Vytiahnutie aktuálnych temp z databázy (1 riadok/slovník)
    latest_paces = db_get_latest_paces(user_id=user_id, ctx=ctx)

    # 3) week meta from DB
    week_row: Optional[Dict[str, Any]] = None
    week_row = db_get_week_row_for_plan(
        user_id=user_id,  week_index=week_index, ctx=ctx
    )

    week_meta: Dict[str, Any] = {
        "week_index": week_index,
        "week_start": week_row.get("week_start") if week_row else None,
        "week_end": week_row.get("week_end") if week_row else None,
        "goal": week_row.get("goal") if week_row else None,
        "focus": week_row.get("focus") if week_row else None,
        "load_phase": week_row.get("load_phase") if week_row else None,
        "planned_km": week_row.get("planned_km") if week_row else None,
        "planned_minutes": week_row.get("planned_minutes") if week_row else None,
    }

    # 4) external occurrences
    external_block: Optional[Dict[str, Any]] = None
    external_fetch_error: Optional[str] = None

    if week_meta.get("week_start") and week_meta.get("week_end"):
        try:
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=str(week_meta["week_start"]),
                to_iso=str(week_meta["week_end"]),
                ctx=ctx,
            )
            external_occurrences_norm = _normalize_external_occurrences_from_service(ext_window)
            external_block = _build_external_block(
                external_occurrences_norm, week_meta["week_start"], week_meta["week_end"]
            )
        except Exception as e:
            external_fetch_error = repr(e)

    # 5) athlete_state
    state_row = db_get_latest_state_for_user(user_id=user_id, version=1, ctx=ctx)
    athlete_state_json = (state_row or {}).get("state_json") or {}
    
    if isinstance(athlete_state_json, dict):
        athlete_state_json["is_returning_beginner"] = is_returning_beginner

    # --- NEW: 5.5) Strength Mapper Context ---
    strength_settings = (prefs_ai.get("strength_settings") or {}) if isinstance(prefs_ai, dict) else {}
    available_eq = strength_settings.get("available") or []
    if not isinstance(available_eq, list): available_eq = []
    eq_mode = strength_settings.get("equipment_mode") or strength_settings.get("location")
    
    active_injuries = prefs_ai.get("injuries") or []
    # Placeholder na hated cviky (ak pridas do fe, mapuj sem)
    disliked_ex = [] 
    
    strength_ai_menu = prepare_strength_context_for_ai(
        user_id=user_id,
        available_equipment=available_eq,
        equipment_mode=eq_mode if isinstance(eq_mode, str) else None,
        injuries=active_injuries,
        disliked_exercises=disliked_ex,
        ctx=ctx
    )

    # 6) context payload
    context_payload: Dict[str, Any] = {
        "schema_version": 2,
        "user_id": user_id,
        "week_index": week_index,
        "overwrite": True,
        "week": week_meta,
        "prefs": prefs_ai,
        "targets": targets_ai,
        "athlete_state": athlete_state_json,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
        "latest_paces": latest_paces, # Pridáme flat dict priamo do payloadu pre AI
        "planning_constraints": {
            "two_a_day_max_days_per_week": int(_two_a_day_cap_from_prefs(prefs_ai)),
            "long_run_days": _long_run_days_from_prefs(prefs_ai),
            "strength_sessions_per_week_target": _strength_sessions_target_from_prefs(prefs_ai),
            "external_events_must_be_included": True,
            "is_returning_beginner": is_returning_beginner,
            "strength_ai_menu": strength_ai_menu # <--- Pridané menu pre AI!
        },
    }

    if external_block is not None:
        context_payload["external_events"] = external_block
    elif external_fetch_error:
        context_payload["planning_constraints"]["external_events_fetch_error"] = external_fetch_error

    return {
        "context_payload": context_payload,
        "week_meta": week_meta,
        "state_row": state_row,
        "prefs_ai": prefs_ai,
        "targets_ai": targets_ai,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
        "analyze_input": analyze_input,
    }


from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

def _safe_int(
    v: Any, default: int = 0, *, min_v: Optional[int] = None, max_v: Optional[int] = None
) -> int:
    try:
        if v is None: out = default
        elif isinstance(v, (int, float)): out = int(v)
        elif isinstance(v, str):
            s = v.strip()
            out = int(float(s)) if s else default
        else: out = int(v)
    except Exception:
        out = default

    if min_v is not None and out < min_v: out = min_v
    if max_v is not None and out > max_v: out = max_v
    return out

def _flatten_prefs(raw_prefs: Any) -> Dict[str, Any]:
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        return raw_prefs["value"]
    return raw_prefs if isinstance(raw_prefs, dict) else {}

def _remove_empty(d: Any) -> Any:
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d

def _minify_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    context2: Dict[str, Any] = {}
    
    # Pridané latest_paces do minifikovaného payloadu
    for k in ("week", "zones", "thresholds", "external_events", "latest_paces"):
        if k in context:
            context2[k] = context[k]

    prefs = _flatten_prefs(context.get("prefs") or {})
    pref_obj = prefs.get("preferences") or {}
    if not isinstance(pref_obj, dict): pref_obj = {}

    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"

    tb = pref_obj.get("training_blocks") or {}
    if not isinstance(tb, dict): tb = {}
    training_blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    context2["prefs"] = {
        "weeks": prefs.get("weeks"),
        "main_sport": prefs.get("main_sport"),
        "add_on_sports": prefs.get("add_on_sports"), 
        "included_sports": prefs.get("included_sports"), 
        "goal_kind": prefs.get("goal_kind"),
        "volume": prefs.get("volume"),
        "preferences": {
            **pref_obj,
            "intensity_model": intensity_model,
            "training_blocks": training_blocks,
        },
        "strength_settings": prefs.get("strength_settings") or {},
        "injuries": prefs.get("injuries") or [], 
    }

    athlete_state = context.get("athlete_state") or {}
    is_beginner = athlete_state.get("is_returning_beginner") 

    ai_state = athlete_state.get("ai_state") or {}
    if isinstance(ai_state, dict):
        ai_state_clean = dict(ai_state)
        ai_state_clean.pop("metrics", None)
        context2["athlete_state"] = {
            "ai_state": ai_state_clean,
            "is_returning_beginner": is_beginner
        }

    us = context.get("user_settings") or {}
    if isinstance(us, dict):
        context2["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }
    
    pc = context.get("planning_constraints")
    if isinstance(pc, dict):
        context2["planning_constraints"] = pc

    return _remove_empty(context2)

def _format_pace(seconds_per_km: int) -> str:
    """Konvertuje sekundy na format mm:ss pre prompt."""
    if not isinstance(seconds_per_km, (int, float)) or seconds_per_km <= 0:
        return ""
    minutes = int(seconds_per_km) // 60
    seconds = int(seconds_per_km) % 60
    return f"{minutes}:{seconds:02d}"

def build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, List[Dict[str, Any]], Optional[int]]:
    
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()
    
    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = "Always speak directly to the athlete and use 'you'."
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Vždy mluv přímo k atletovi a používej 2. osobu."
    else:
        lang_label = "Slovak"
        second_person_note = "Vždy hovor priamo k atlétovi a používej 2. osobu."

    week = context_payload.get("week") or {}
    prefs = _flatten_prefs(context_payload.get("prefs") or {})
    
    constraints = context_payload.get("planning_constraints") or {}
    is_returning_beginner = bool(constraints.get("is_returning_beginner"))

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    planned_minutes = week.get("planned_minutes")
    main_sport = prefs.get("main_sport") or "run"
    
    add_on = prefs.get("add_on_sports")
    included = prefs.get("included_sports")

    sports_set = set()
    sports_set.add(main_sport)

    if isinstance(add_on, list):
        for s in add_on:
            if isinstance(s, str) and s: sports_set.add(s.lower())
    elif isinstance(included, list):
        for s in included:
            if isinstance(s, str) and s: sports_set.add(s.lower())

    final_sports_list = list(sports_set)

    pref_obj = prefs.get("preferences") or {}
    if not isinstance(pref_obj, dict): pref_obj = {}

    two = pref_obj.get("two_a_day") or {}
    two_enabled = bool(two.get("enabled")) if isinstance(two, dict) else False
    two_cap = _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2) if two_enabled else 0

    long_run_days = pref_obj.get("long_run_days") or []
    if isinstance(long_run_days, list):
        long_run_days = [str(d) for d in long_run_days if isinstance(d, str) and d.strip()]
    else: long_run_days = []

    avoid_back_to_back = bool(pref_obj.get("avoid_back_to_back_hard"))
    intensity_model = "pyramidal" if str(pref_obj.get("intensity_model") or "").lower() == "pyramidal" else "polarized"
    has_zones = bool(pref_obj.get("use_zones", True))

    tb = pref_obj.get("training_blocks") or {}
    if not isinstance(tb, dict): tb = {}
    blocks = {
        "vo2max": bool(tb.get("vo2max")),
        "ftp": bool(tb.get("ftp")),
        "threshold": bool(tb.get("threshold")),
    }

    strength_settings = prefs.get("strength_settings")
    if not isinstance(strength_settings, dict): strength_settings = {}
    
    strength_target_int: Optional[int] = None
    ss_raw = strength_settings.get("sessions_per_week")
    if isinstance(ss_raw, (int, float, str)):
        try: strength_target_int = int(ss_raw)
        except Exception: pass
    
    ext = context_payload.get("external_events") or {}
    ext_occ = ext.get("occurrences") if isinstance(ext, dict) else []
    if not isinstance(ext_occ, list): ext_occ = []
    ext_count = len(ext_occ)
    ext_minutes_total = sum(_safe_int(e.get("duration_min"), 0) for e in ext_occ if isinstance(e, dict))

    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode") if isinstance(volume_prefs, dict) else None
    volume_value = volume_prefs.get("value") if isinstance(volume_prefs, dict) else None

    if isinstance(planned_minutes, (int, float)):
        rem = max(0, int(planned_minutes) - ext_minutes_total)
        weekly_volume_line = f"- WEEKLY VOLUME: Target {planned_minutes} min. External events: {ext_minutes_total} min. Schedule approx {rem} min NEW training.\n"
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        tgt = int(volume_value * 60)
        rem = max(0, tgt - ext_minutes_total)
        weekly_volume_line = f"- WEEKLY VOLUME: Target {tgt} min. External events: {ext_minutes_total} min. Schedule approx {rem} min NEW training.\n"
    else:
        weekly_volume_line = "- Weekly intent: infer from recent_load, count external events.\n"

    back_to_back_rule = (
        "- AVOID BACK-TO-BACK HARD: YES (Strict).\n" if avoid_back_to_back
        else "- AVOID BACK-TO-BACK HARD: Soft preference.\n"
    )

    long_run_days_str = ", ".join(long_run_days) if long_run_days else "none"
    strength_str = f"{strength_target_int}× per week" if strength_target_int is not None else "not specified"
    
    active_injuries = prefs.get("injuries") or []
    injury_rule = ""
    if isinstance(active_injuries, list) and len(active_injuries) > 0:
        inj_details = []
        max_severity = 0
        for inj in active_injuries:
            if isinstance(inj, dict):
                sev = _safe_int(inj.get("severity"), 0)
                if sev > max_severity: max_severity = sev
                inj_details.append(f"{inj.get('area')} ({inj.get('type')}, sev: {sev})")
        
        inj_str = ", ".join(inj_details)
        if max_severity >= 7:
            injury_rule = (
                f"- CRITICAL MEDICAL RULE (HARD): SEVERE INJURY ({inj_str}). "
                "DO NOT SCHEDULE TRAINING. All days must be REST. Title: 'Lekárske voľno'.\n\n"
            )
        else:
            injury_rule = (
                f"- ACTIVE INJURY ({inj_str}): Adjust for recovery. No high intensity. Safe mode.\n\n"
            )

    beginner_rule = ""
    explanation_rule = "- NOTES: 2-3 short sentences for every session.\n\n"
    
    if is_returning_beginner:
        beginner_rule = (
            "- BEGINNER / RETURNING ATHLETE PROTOCOL (CRITICAL):\n"
            "  The user has NO recent activity. They are unfamiliar with technical terms.\n"
            "  - You MUST explain intensity using human feeling (Talk Test).\n"
            "  - MANDATORY CUES for Run and Ride:\n"
            "    * 'Talk Test': You should be able to speak in full sentences without gasping.\n"
            "    * 'Sing Test': If you can hum or sing, the pace is perfect.\n"
            "  - FOR BIKE: Emphasize 'Cadence over Power' (keep pedaling easy).\n"
            "  - Emphasize WHY: 'Adaptation of joints and tendons takes more time than muscles.'\n"
            "  - In the output `meta` object, set `is_beginner_adaptation`: true.\n\n"
        )
        explanation_rule = "- NOTES: 3-5 detailed, encouraging sentences. Explain exactly HOW it should feel (Talk/Sing test) and WHY.\n\n"

    system_txt = (
        "You are an endurance coaching assistant. "
        "Design a daily workout schedule for ONE week based on the JSON context. "
        "Return ONE valid JSON object."
    )

    schema_text = """
    {
    "schema_version": 3,
    "meta": {
        "is_beginner_adaptation": boolean,
        "msg": "Explanation for the user if beginner mode is active"
    },
    "days": [
        {
        "date": "YYYY-MM-DD",
        "sessions": [
            {
            "sport": "run" | "ride" | "swim" | "strength" | "other",
            "title": string,
            "duration_min": number,
            "intensity": string | null,
            "session_type": string | null,
            "notes": string | null,
            "structure": {
                "warmup": { "minutes": number, "notes": string },
                
                "main_part": [ { "minutes": number, "notes": string, "target": string } ] | { "minutes": number, "notes": string },
                
                "cooldown": { "minutes": number, "notes": string },
                
                "activation": [ { "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": string } ] | null,
                "strength_main_part": [ { "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": string } ] | null,
                "add_ons": [ { "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": string } ] | null
            } | null,
            "payload"?: object | null
            }
        ]
        }
    ],
    "warnings"?: [string]
    }
    """.strip()

    date_integrity_rule = "- DATE INTEGRITY: Use only dates inside the given Week range.\n\n"
    
    external_rules = (
        "- EXTERNAL EVENTS (HARD): Include EVERY external event from context EXACTLY once on the correct date. "
        "For these events, you MUST set `session_type: \"external_event\"`.\n\n"
    )

    two_a_day_rule = f"- TWO-A-DAY: Max {two_cap} days/week. Prefer 1 session/day.\n\n"
    long_run_rule = f"- LONG RUN: If run is main sport, 1 long run (pref: {long_run_days_str}).\n\n"

    multi_sport_rule = ""
    if len(final_sports_list) > 1:
        other_sports = [s for s in final_sports_list if s != main_sport and s != "strength"]
        if other_sports:
            multi_sport_rule = (
                f"- MULTI-SPORT: Athlete sports: {', '.join(final_sports_list)}. "
                f"Schedule {', '.join(other_sports)} sessions too. Balanced plan.\n\n"
            )

    strength_rule = f"- STRENGTH: Aim for {strength_str}. Use sport='strength'.\n\n"
    
    latest_paces = context_payload.get("latest_paces") or {}
    if has_zones:
        # Dynamická tvorba inštrukcií pre tempá z flat DB štruktúry
        pace_instructions = ""
        if isinstance(latest_paces, dict) and any(latest_paces.get(k) for k in ["z1_pace_s", "z2_pace_s", "z3_pace_s", "z4_pace_s", "z5_pace_s"]):
            pace_str_parts = []
            for i in range(1, 6):
                key = f"z{i}_pace_s"
                val = latest_paces.get(key)
                if val is not None:
                    pace_str_parts.append(f"Z{i}: {_format_pace(val)}")
            
            if pace_str_parts:
                pace_instructions = (
                    f"CRITICAL: When prescribing Pace for running, strictly use the following reference from user preferences: "
                    f"{', '.join(pace_str_parts)}. Do not deviate by more than 5-10 seconds per km unless the session is specifically hilly or trail-based.\n"
                )
        else:
            # Ak tabuľka temp ešte neobsahuje dáta
            pace_instructions = (
                "CRITICAL: No specific pace history found. You must ESTIMATE realistic target paces based on the user's recent load, target race time, and athlete state capabilities. "
                "Provide a realistic average pace (min/km) for the specific zone being targeted, not max pace. Keep it conservative.\n"
            )

        intensity_format_rule = (
            "- INTENSITY FORMATTING (HAS ZONES): Main `intensity` field MUST be 'Z1'-'Z5'. "
            "In `notes` for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH a specific Target Heart Rate range (use 'bpm') AND Pace (min/km) or Power (W). "
            "CRITICAL INSTRUCTION FOR HEART RATE: The zones in context_payload.zones are your absolute BOUNDARIES for zones. "
            "DO NOT output the entire width of the zone (e.g., if Z1 is 0-154 bpm, do NOT write '0-154 bpm'). "
            "Instead, prescribe a narrower, realistic target range (e.g., a 10-15 bpm window like '135-150 bpm') that fits strictly WITHIN the user's specific zone limits. "
            "NEVER use generic human heart rates; strictly respect the user's minimum and maximum bounds for each zone. "
            "Example Format: 'Z2 (145-155 bpm) @ [insert pace] min/km'. "
            "MANDATORY: You MUST provide Pace for ALL parts, including warmup and cooldown.\n"
            f"{pace_instructions}\n"
        )
    else:
        intensity_format_rule = (
            "- INTENSITY FORMATTING (NO ZONES): Main `intensity` field MUST be 'RPE X/10'. "
            "In `notes` for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH RPE AND Pace (min/km) or Power (W). "
            "Example Format: 'RPE 3/10 @ 6:00-6:30 min/km'. "
            "MANDATORY: You MUST provide Pace for ALL parts, including warmup and cooldown. "
            "CRITICAL: Keep paces realistic and lean towards SLOWER, more conservative paces for easy runs, warmups, and cooldowns.\n\n"
        )

    endurance_structure_rule = (
        "- ENDURANCE STRUCTURE (RUN & RIDE): For every running and cycling session, "
        "provide a detailed `structure` object using `warmup`, `main_part`, and `cooldown`.\n\n"
    )

    strength_structure_rule = (
        "- STRENGTH STRUCTURE: When creating a 'strength' session, use the provided 'strength_ai_menu'. "
        "Use ONLY the specific 'exercise_id' values. Distribute the exercises into 'activation' (1-2 exercises), "
        "'strength_main_part' (3-5 heavy exercises), and 'add_ons' (1-3 core/accessory exercises).\n\n"
    )

    intensity_model_rule = f"- INTENSITY MODEL: {intensity_model}. Use Zones: {has_zones}\n\n"
    blocks_rule = f"- TRAINING BLOCKS: {', '.join([k for k,v in blocks.items() if v]) or 'none'}.\n\n"

    context_for_ai = _minify_context_for_ai(context_payload)
    safe_settings = {"language": settings.get("language"), "timezone": settings.get("timezone")}
    context_for_ai["user_settings"] = safe_settings

    user_txt = (
        "Generate a weekly plan.\n"
        f"Week: {week_index} ({week_start} .. {week_end})\n"
        f"Main Sport: {main_sport}\n"
        f"All Sports: {', '.join(final_sports_list)}\n"
        f"External events: {ext_count}\n\n"
        + date_integrity_rule
        + external_rules
        + injury_rule 
        + beginner_rule
        + two_a_day_rule
        + long_run_rule
        + multi_sport_rule
        + strength_rule
        + intensity_format_rule
        + endurance_structure_rule 
        + strength_structure_rule
        + intensity_model_rule
        + blocks_rule
        + weekly_volume_line
        + back_to_back_rule
        + explanation_rule
        + "\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + schema_text
        + "\n\nRequirements:\n"
        + "- Single valid JSON matching schema.\n"
        + f"- Language: {lang_label}, address user as 'you' ({second_person_note}).\n"
        + "- Do NOT invent extreme workloads.\n"
        + "- OUTPUT FORMATTING: Return ONLY valid JSON. Do not output any markdown formatting like ```json, and absolutely NO conversational text, explanations, or lists before or after the JSON.\n"
    )

    return system_txt, user_txt, [], strength_target_int
