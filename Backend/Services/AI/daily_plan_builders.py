# ===== Services/AI/daily_builders.py =====
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

import os

from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Routes_DB.coach_plan_weekly import db_get_week_row_for_plan
from Services.AI.athlete_state_builders import build_input_from_db
from Services.coach_external_events import service_list_external_events_window


# -----------------------------------------------------------------------------
# NEW APPROACH (Simplified)
# - AI plans the whole week calendar (days + sessions).
# - The ONLY hard constraint we must enforce is external events from DB.
# - No weekly_template fixed days, no prefs hard_locks, no day_constraints/open_slots.
# - We pass minimal planning constraints to the LLM:
#     - long_run_days preference
#     - two-a-day max days/week cap (0..2)
#     - strength sessions per week (later via prefs schema)
# -----------------------------------------------------------------------------

WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}

_WEEKDAY_TO_ABBR: Dict[int, str] = {
    0: "Mon",
    1: "Tue",
    2: "Wed",
    3: "Thu",
    4: "Fri",
    5: "Sat",
    6: "Sun",
}

_ALLOWED_SESSION_SPORTS = {"run", "ride", "strength", "swim", "other"}
_ALLOWED_EXTERNAL_INTENSITIES = {"hard", "medium", "easy"}


# -----------------------------------------------------------------------------
# Debug / Railway prints
# -----------------------------------------------------------------------------
# Zapneš na Railway env varom:
#   DAILY_DEBUG=1
_DEBUG_ENABLED = str(os.getenv("DAILY_DEBUG") or "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _dprint(*parts: Any) -> None:
    if not _DEBUG_ENABLED:
        return
    try:
        msg = " ".join(str(p) for p in parts)
        print(f"[DAILY_BUILDER] {msg}")
    except Exception:
        pass


def _safe_int(v: Any, default: int, *, min_v: Optional[int] = None, max_v: Optional[int] = None) -> int:
    try:
        if v is None:
            out = default
        elif isinstance(v, bool):
            out = int(v)  # True->1 False->0
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


def _weekday_abbr_from_iso(d: str) -> Optional[str]:
    if not isinstance(d, str) or not d:
        return None
    try:
        dd = date.fromisoformat(d[:10])
        return _WEEKDAY_TO_ABBR.get(dd.weekday())
    except Exception:
        return None


def _coerce_session_sport(raw_sport: Any) -> str:
    """
    Map arbitrary sports to the FE schema sport enum.
    """
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
    """
    Normalizes intensity to: hard | medium | easy | None
    Accepts common variants.
    """
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


# -------------------------
# Daily rows (AI -> DB rows)
# -------------------------

def build_daily_rows_from_ai(
    user_id: int,
    plan_id: Optional[str],
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Converts the final daily_plan JSON (already enriched with strength mapper)
    into rows for coach_plan_daily.
    """
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []

    for day in days:
        date_str = day.get("date")
        sessions = day.get("sessions") or []
        if not date_str or not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict):
                continue

            sport_safe = _coerce_session_sport(s.get("sport") or "other")

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str,
                "sport": sport_safe,
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "zone_text": s.get("zone_text"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": "ai_daily_v1",
                "plan_id": plan_id,
                "session_type": s.get("session_type"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            }
            rows.append(row)

    return rows


# -------------------------
# Prefs helpers
# -------------------------

def flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    build_input_from_db can return:
      "prefs": { "value": { ... } } or already a plain dict.
    We want a plain dict for AI/logic.
    """
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        return raw["value"]
    return raw if isinstance(raw, dict) else {}


def extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def _two_a_day_cap_from_prefs(pref_obj: Dict[str, Any]) -> int:
    """
    preferences.two_a_day = { enabled: bool, max_days_per_week: int }
    AI can choose which days are two-a-day, but must respect this cap (0..2).
    """
    if not isinstance(pref_obj, dict):
        return 0

    two = pref_obj.get("two_a_day") or {}
    if not isinstance(two, dict):
        return 0

    if not bool(two.get("enabled")):
        return 0

    return _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2)


# -------------------------
# External events -> normalized occurrences
# -------------------------

def _normalize_external_occurrences_from_service(ext_window: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    service_list_external_events_window returns:
      {"success": True, "events": [ ... ]}
    We normalize minimal fields and keep DB truth (duration/intensity/title).
    """
    events = ext_window.get("events") or []
    if not isinstance(events, list):
        return []

    out: List[Dict[str, Any]] = []
    for e in events:
        if not isinstance(e, dict):
            continue

        occ_date = e.get("occurrence_date") or e.get("date") or e.get("single_date")
        if not isinstance(occ_date, str) or not occ_date:
            continue

        ds = occ_date[:10]
        wd = _weekday_abbr_from_iso(ds)
        if not wd:
            continue

        sport_raw = e.get("sport")
        duration_min = e.get("duration_min")
        dur_int = int(duration_min) if isinstance(duration_min, (int, float)) else None

        intensity = _normalize_external_intensity(e.get("intensity"))

        out.append(
            {
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
                "intensity": intensity,
                "allow_other_training": e.get("allow_other_training"),
            }
        )

    return out


# -------------------------
# Context builder (DB -> AI context)
# -------------------------

def build_daily_context_from_db(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str],
    overwrite: bool,
    user_jwt: Optional[str],
    service: bool,
) -> Dict[str, Any]:
    jwt = user_jwt

    _dprint("START build_daily_context_from_db | user_id=", user_id, "| week_index=", week_index, "| plan_id(in)=", plan_id)

    # 1) resolve plan_id
    plan_id_effective: Optional[str] = plan_id
    resolved_via = "input"
    if not plan_id_effective:
        meta = db_get_active_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        )
        if meta and isinstance(meta.get("plan_id"), str):
            plan_id_effective = meta["plan_id"]
            resolved_via = "active_meta"
        else:
            meta2 = db_get_latest_plan_meta_for_user(
                user_id=user_id,
                user_jwt=jwt,
                service=service,
            )
            if meta2 and isinstance(meta2.get("plan_id"), str):
                plan_id_effective = meta2["plan_id"]
                resolved_via = "latest_meta"

    _dprint("plan_id_effective=", plan_id_effective, "| resolved_via=", resolved_via)

    # 2) analyze input (prefs, recent_load, zones, thresholds)
    analyze_input = build_input_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    prefs_ai = flatten_prefs_for_ai(analyze_input)
    targets_ai = extract_targets_from_prefs(prefs_ai)

    pref_obj = (prefs_ai.get("preferences") or {}) if isinstance(prefs_ai, dict) else {}
    two_a_day_cap = _two_a_day_cap_from_prefs(pref_obj)

    long_run_days = pref_obj.get("long_run_days") or []
    if not isinstance(long_run_days, list):
        long_run_days = []
    long_run_days = [str(d) for d in long_run_days if isinstance(d, str)]

    _dprint(
        "prefs: main_sport=",
        (prefs_ai.get("main_sport") if isinstance(prefs_ai, dict) else None),
        "| two_a_day_cap=",
        two_a_day_cap,
        "| long_run_days=",
        long_run_days,
    )

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

    # 3) week meta from DB
    week_row: Optional[Dict[str, Any]] = None
    if plan_id_effective:
        week_row = db_get_week_row_for_plan(
            user_id=user_id,
            plan_id=plan_id_effective,
            week_index=week_index,
            user_jwt=jwt,
            service=service,
        )

    if not week_row:
        _dprint(
            "WARNING: week_row is None/empty. "
            "Check DB: coach_plan_weekly row exists for plan_id+week_index."
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

    # 4) external occurrences (DB) – ONLY hard constraint
    external_block: Optional[Dict[str, Any]] = None
    external_occurrences_norm: List[Dict[str, Any]] = []

    if week_meta.get("week_start") and week_meta.get("week_end"):
        try:
            _dprint("external_events: querying window", week_meta["week_start"], "->", week_meta["week_end"])
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=str(week_meta["week_start"]),
                to_iso=str(week_meta["week_end"]),
                user_jwt=jwt,
                service=service,
            )
            external_occurrences_norm = _normalize_external_occurrences_from_service(ext_window)
            _dprint("external_events: normalized_occurrences(DB)=", len(external_occurrences_norm))

            external_block = {
                "schema_version": 1,
                "occurrences": [
                    {
                        "date": e.get("date"),
                        "weekday": e.get("weekday"),
                        "sport_raw": e.get("sport_raw"),
                        "session_sport": e.get("session_sport"),
                        "title": e.get("title"),
                        "duration_min": e.get("duration_min"),
                        "priority": e.get("priority"),
                        "start_time_local": e.get("start_time_local"),
                        "notes": e.get("notes"),
                        "source": e.get("source"),
                        "intensity": e.get("intensity"),
                        "allow_other_training": e.get("allow_other_training"),
                    }
                    for e in external_occurrences_norm
                ],
                "window": {"from": week_meta["week_start"], "to": week_meta["week_end"]},
            }
        except Exception as e:
            _dprint("external_events: ERROR", repr(e))
            external_block = None
            external_occurrences_norm = []
    else:
        _dprint("external_events: SKIP (missing week_start/week_end)")

    # 5) athlete_state
    state_row = db_get_latest_state_for_user(
        user_id=user_id,
        version=1,
        user_jwt=jwt,
        service=service,
    )
    athlete_state_json = (state_row or {}).get("state_json") or None
    _dprint("athlete_state:", "present" if athlete_state_json else "missing", "| state_row_id=", (state_row or {}).get("id"))

    # 6) context payload for AI / services
    context_payload: Dict[str, Any] = {
        "schema_version": 2,
        "user_id": user_id,
        "week_index": week_index,
        "plan_id": plan_id_effective,
        "overwrite": overwrite,
        "week": week_meta,
        "prefs": prefs_ai,
        "targets": targets_ai,
        "athlete_state": athlete_state_json,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
        "planning_constraints": {
            "two_a_day_max_days_per_week": int(two_a_day_cap),
            "long_run_days": long_run_days,
            "external_events_must_be_included": True,
        },
    }

    if external_block is not None:
        context_payload["external_events"] = external_block

    _dprint(
        "DONE build_daily_context_from_db | plan_id_effective=",
        plan_id_effective,
        "| week_start=",
        week_meta.get("week_start"),
        "| week_end=",
        week_meta.get("week_end"),
        "| external_occurrences_total=",
        len(external_occurrences_norm),
        "| two_a_day_cap=",
        two_a_day_cap,
    )

    return {
        "context_payload": context_payload,
        "plan_id_effective": plan_id_effective,
        "week_meta": week_meta,
        "state_row": state_row,
        "prefs_ai": prefs_ai,
        "targets_ai": targets_ai,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
        "analyze_input": analyze_input,
    }