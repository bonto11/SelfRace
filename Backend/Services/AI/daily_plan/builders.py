# Services/AI/daily_plan/builders.py
from __future__ import annotations

import copy
from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, Optional, List

from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.coach_external_events import service_list_external_events_window
from Services.coach_strength_mapper import prepare_strength_context_for_ai

from DB.user_pace_history import db_get_latest_paces
from DB.coach_athlete_state import db_get_latest_state_for_user
from DB.coach_plan_weekly import db_get_week_row_for_plan
from Services.coach_user_notes import service_get_notes_for_builder

from Services.AI.athlete_state.builders import build_input_from_db

from Modules.Supabase.auth import AuthCtx
from Configs.config import WEEKDAY_TO_ABBR

_ALLOWED_SESSION_SPORTS = {"run", "ride", "strength", "swim", "other"}
_ALLOWED_EXTERNAL_INTENSITIES = {"hard", "medium", "easy"}


# ============================================================
# HELPERS
# ============================================================

def _safe_int(
    v: Any,
    default: int = 0,
    *,
    min_v: Optional[int] = None,
    max_v: Optional[int] = None,
) -> int:
    """Bezpečná konverzia na int s voliteľnými hranicami."""
    try:
        if v is None:
            out = default
        elif isinstance(v, (int, float)):
            out = int(v)
        elif isinstance(v, str):
            s = v.strip()
            out = int(float(s)) if s else default
        else:
            out = int(v)
    except Exception:
        out = default
    if min_v is not None and out < min_v:
        out = min_v
    if max_v is not None and out > max_v:
        out = max_v
    return out


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


def _weekday_abbr_from_iso(d: str) -> Optional[str]:
    """Vráti skratku dňa (Mon/Tue...) z ISO dátumu."""
    if not isinstance(d, str) or not d:
        return None
    try:
        dd = date.fromisoformat(d[:10])
        return WEEKDAY_TO_ABBR.get(dd.weekday())
    except Exception:
        return None


def _weekday_abbr_from_int(v: Any) -> Optional[str]:
    """Vráti skratku dňa z čísla (1=Mon ... 7=Sun)."""
    try:
        n = int(v)
    except Exception:
        return None
    return {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"}.get(n)


def _coerce_session_sport(raw_sport: Any) -> str:
    """Normalizuje sport na povolené hodnoty."""
    s = str(raw_sport or "").strip().lower()
    if s in _ALLOWED_SESSION_SPORTS:
        return s
    if s in {"bike", "cycling", "bicycle"}:
        return "ride"
    if s in {"run", "running"}:
        return "run"
    if s in {"gym", "weights", "weightlifting"}:
        return "strength"
    if s in {"swim", "swimming"}:
        return "swim"
    return "other"


def _normalize_external_intensity(v: Any) -> Optional[str]:
    """Normalizuje intenzitu externej aktivity na hard/medium/easy."""
    s = str(v or "").strip().lower()
    if not s:
        return None
    if s in {"high", "very_hard", "vhard", "hard"}:
        return "hard"
    if s in {"moderate", "mod", "mid", "medium"}:
        return "medium"
    if s in {"low", "easy", "light"}:
        return "easy"
    return s if s in _ALLOWED_EXTERNAL_INTENSITIES else None


def check_is_returning_beginner(analyze_input: Dict[str, Any]) -> bool:
    """
    Detekuje vracajúceho sa začiatočníka — žiadne aktivity alebo posledná > 42 dní.
    Shared helper — používa sa v athlete_state, weekly aj daily builders.
    """
    last_activities = analyze_input.get("last_activities") or []
    if not last_activities:
        return True

    latest_date_str: Optional[str] = None
    for act in last_activities:
        d = (
            act.get("start_date_local")
            or act.get("start_date")
            or act.get("date")
        )
        if d and (latest_date_str is None or d > latest_date_str):
            latest_date_str = d

    if not latest_date_str:
        return True

    try:
        latest_dt = date.fromisoformat(latest_date_str[:10])
        return (date.today() - latest_dt).days > 42
    except Exception:
        return False


# ============================================================
# PREFS HELPERS
# ============================================================

def flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    """Unwrapuje vnorený 'value' kľúč z prefs ak existuje."""
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and isinstance(raw.get("value"), dict):
        return copy.deepcopy(raw["value"])
    return copy.deepcopy(raw) if isinstance(raw, dict) else {}


def extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    """Vytiahne targets blok z prefs."""
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def _two_a_day_cap_from_prefs(prefs: Dict[str, Any]) -> int:
    """Vráti max počet two-a-day dní za týždeň z prefs."""
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict):
        return 0
    two = pref_obj.get("two_a_day") or {}
    if not isinstance(two, dict) or not bool(two.get("enabled")):
        return 0
    return _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2)


def _long_run_days_from_prefs(prefs: Dict[str, Any]) -> List[str]:
    """Vráti preferované dni pre dlhý beh."""
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict):
        return []
    days = pref_obj.get("long_run_days") or []
    if not isinstance(days, list):
        return []
    return [d.strip() for d in days if isinstance(d, str) and d.strip()]


def _strength_sessions_target_from_prefs(prefs: Dict[str, Any]) -> Optional[int]:
    """Vytiahne cieľový počet silových tréningov za týždeň."""
    strength_settings = prefs.get("strength_settings")
    if isinstance(strength_settings, dict):
        raw = strength_settings.get("sessions_per_week")
        if isinstance(raw, (int, float, str)):
            try:
                return int(raw)
            except Exception:
                pass
    targets = prefs.get("targets")
    legacy = (
        (targets.get("strength") or {}).get("sessions_per_week")
        if isinstance(targets, dict)
        else None
    )
    if isinstance(legacy, (int, float, str)):
        try:
            return int(legacy)
        except Exception:
            pass
    return None


def _has_strength_in_plan(prefs: Dict[str, Any]) -> bool:
    """Kontroluje či má user strength v pláne — pred načítaním strength menu."""
    target = _strength_sessions_target_from_prefs(prefs)
    if target and target > 0:
        return True
    included = prefs.get("included_sports") or prefs.get("add_on_sports") or []
    if isinstance(included, list) and "strength" in included:
        return True
    return False


# ============================================================
# EXTERNAL EVENTS
# ============================================================

def _normalize_external_occurrences_from_service(
    ext_window: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Normalizuje external events z rôznych formátov na štandardný zoznam."""
    if not isinstance(ext_window, dict):
        return []
    raw_list: Any = ext_window.get("occurrences") or ext_window.get("events")
    if not isinstance(raw_list, list):
        win = ext_window.get("window")
        if isinstance(win, dict):
            raw_list = win.get("events")
    if not isinstance(raw_list, list):
        return []

    out: List[Dict[str, Any]] = []
    for e in raw_list:
        if not isinstance(e, dict):
            continue
        occ_date = (
            e.get("occurrence_date")
            or e.get("date")
            or e.get("start_date_local")
            or e.get("start_date")
        )
        if not isinstance(occ_date, str) or not occ_date:
            continue
        ds = occ_date[:10]
        wd = (
            _weekday_abbr_from_int(e.get("occurrence_weekday_int"))
            or (
                e.get("occurrence_weekday")
                if isinstance(e.get("occurrence_weekday"), str)
                else None
            )
            or _weekday_abbr_from_iso(ds)
        )
        if not wd:
            continue
        sport_raw = e.get("sport") or e.get("sport_raw")
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


def _build_external_block(
    occurrences: List[Dict[str, Any]], week_start: Any, week_end: Any
) -> Dict[str, Any]:
    """Zostaví external_events blok pre context_payload."""
    return {
        "schema_version": 1,
        "occurrences": occurrences,
        "window": {"from": week_start, "to": week_end},
    }


# ============================================================
# AI OUTPUT PARSERS
# ============================================================

def build_daily_rows_from_ai(
    user_id: int, daily_plan: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Prevedie AI daily output na DB riadky pre coach_plan_daily tabuľku."""
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []
    if not isinstance(days, list):
        return rows

    for day in days:
        if not isinstance(day, dict):
            continue
        date_str = day.get("date") or day.get("plan_date")
        sessions = day.get("sessions") or []
        if not isinstance(date_str, str) or not date_str:
            continue
        if not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict):
                continue
            sport_safe = _coerce_session_sport(s.get("sport") or "other")
            rows.append({
                "user_id": user_id,
                "plan_date": date_str[:10],
                "sport": sport_safe,
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "structure": s.get("structure"),
                "notes": s.get("notes") or s.get("description"),
                "source": "ai_daily_v2",
                "session_type": s.get("session_type") or s.get("kind"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            })
    return rows


# ============================================================
# MAIN BUILDER
# ============================================================

def build_daily_context_from_db(
    user_id: int,
    *,
    week_index: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Zostaví kompletný context_payload pre daily plan generátor.
    Načíta analyze_input, athlete_state, week_row, external_events a strength menu.
    Strength menu sa načíta len ak má user strength v pláne.
    """
    # Plný analyze input — recovery, recent_load, zones, thresholds, last_activities
    analyze_input = build_input_from_db(user_id=user_id, ctx=ctx) or {}

    prefs_ai = flatten_prefs_for_ai(analyze_input)
    targets_ai = extract_targets_from_prefs(prefs_ai)
    is_returning_beginner = check_is_returning_beginner(analyze_input)

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

    latest_paces = db_get_latest_paces(user_id=user_id, ctx=ctx)

    # Týždenný meta riadok z DB
    week_row = db_get_week_row_for_plan(
        user_id=user_id, week_index=week_index, ctx=ctx
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

    # External events — len ak vieme dátumy týždňa
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
            external_occurrences = _normalize_external_occurrences_from_service(ext_window)
            external_block = _build_external_block(
                external_occurrences,
                week_meta["week_start"],
                week_meta["week_end"],
            )
        except Exception as e:
            external_fetch_error = repr(e)

    # Athlete state
    state_row = db_get_latest_state_for_user(user_id=user_id, version=1, ctx=ctx)
    athlete_state_json = (state_row or {}).get("state_json") or {}
    if isinstance(athlete_state_json, dict):
        athlete_state_json["is_returning_beginner"] = is_returning_beginner

    # Strength menu — len ak má user strength v pláne (šetrí DB call)
    strength_ai_menu: Any = None
    if _has_strength_in_plan(prefs_ai):
        try:
            strength_settings = (
                prefs_ai.get("strength_settings") or {}
                if isinstance(prefs_ai, dict)
                else {}
            )
            available_eq = strength_settings.get("available") or []
            if not isinstance(available_eq, list):
                available_eq = []
            eq_mode = strength_settings.get("equipment_mode") or strength_settings.get("location")
            active_injuries = prefs_ai.get("injuries") or []

            strength_ai_menu = prepare_strength_context_for_ai(
                user_id=user_id,
                available_equipment=available_eq,
                equipment_mode=eq_mode if isinstance(eq_mode, str) else None,
                injuries=active_injuries,
                disliked_exercises=[],
                ctx=ctx,
            )
        except Exception as e:
            print(f"[DAILY][builder] strength menu fetch failed: {repr(e)}")

    # Coach notes — sticky + ephemeral pre AI
    coach_notes = {"sticky_notes": [], "ephemeral_note": None, "ephemeral_note_id": None}
    try:
        coach_notes = service_get_notes_for_builder(user_id=user_id, ctx=ctx)
    except Exception as e:
        print(f"❌ [DAILY][builder] coach notes fetch failed: {repr(e)}")

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
        "latest_paces": latest_paces,
        "planning_constraints": {
            "two_a_day_max_days_per_week": _two_a_day_cap_from_prefs(prefs_ai),
            "long_run_days": _long_run_days_from_prefs(prefs_ai),
            "strength_sessions_per_week_target": _strength_sessions_target_from_prefs(prefs_ai),
            "external_events_must_be_included": True,
            "is_returning_beginner": is_returning_beginner,
            "strength_ai_menu": strength_ai_menu,
        },
        "coach_notes": {
            "sticky_notes": coach_notes.get("sticky_notes") or [],
            "ephemeral_note": coach_notes.get("ephemeral_note"),
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
        "ephemeral_note_id": coach_notes.get("ephemeral_note_id"),
    }