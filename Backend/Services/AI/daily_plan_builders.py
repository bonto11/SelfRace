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


def _safe_int(
    v: Any, default: int, *, min_v: Optional[int] = None, max_v: Optional[int] = None
) -> int:
    try:
        if v is None:
            out = default
        elif isinstance(v, bool):
            out = int(v)
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


def _weekday_abbr_from_int(v: Any) -> Optional[str]:
    try:
        n = int(v)
    except Exception:
        return None
    return {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"}.get(n)


def _coerce_session_sport(raw_sport: Any) -> str:
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


def build_daily_rows_from_ai(
    user_id: int,
    plan_id: Optional[str],
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []

    if not isinstance(days, list):
        return rows

    for day in days:
        if not isinstance(day, dict):
            continue

        date_str = day.get("date")
        sessions = day.get("sessions") or []
        if not isinstance(date_str, str) or not date_str:
            continue
        if not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict):
                continue

            sport_safe = _coerce_session_sport(s.get("sport") or "other")

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str[:10],
                "sport": sport_safe,
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "zone_text": s.get("zone_text"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": "ai_daily_v2",
                "plan_id": plan_id,
                "session_type": s.get("session_type"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            }
            rows.append(row)

    return rows


def flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        return raw["value"]
    return raw if isinstance(raw, dict) else {}


def extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def _two_a_day_cap_from_prefs(prefs: Dict[str, Any]) -> int:
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict):
        return 0

    two = pref_obj.get("two_a_day") or {}
    if not isinstance(two, dict):
        return 0

    if not bool(two.get("enabled")):
        return 0

    return _safe_int(two.get("max_days_per_week"), 0, min_v=0, max_v=2)


def _long_run_days_from_prefs(prefs: Dict[str, Any]) -> List[str]:
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict):
        return []
    days = pref_obj.get("long_run_days") or []
    if not isinstance(days, list):
        return []
    out: List[str] = []
    for d in days:
        if isinstance(d, str) and d.strip():
            out.append(d.strip())
    return out


def _strength_sessions_target_from_prefs(prefs: Dict[str, Any]) -> Optional[int]:
    strength_settings = prefs.get("strength_settings")
    if isinstance(strength_settings, dict):
        raw = strength_settings.get("sessions_per_week")
        if isinstance(raw, (int, float, str)):
            try:
                return int(raw)
            except Exception:
                return None

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
            return None

    return None


def _normalize_external_occurrences_from_service(
    ext_window: Dict[str, Any],
) -> List[Dict[str, Any]]:
    if not isinstance(ext_window, dict):
        return []

    raw_list: Any = ext_window.get("occurrences")
    if not isinstance(raw_list, list):
        raw_list = ext_window.get("events")
    if not isinstance(raw_list, list):
        win = ext_window.get("window")
        if isinstance(win, dict) and isinstance(win.get("events"), list):
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
            or e.get("start_date_iso")
            or e.get("single_date")
        )
        if not isinstance(occ_date, str) or not occ_date:
            continue

        ds = occ_date[:10]

        # ✅ preferuj čo vrátil BE, fallback na výpočet z dátumu
        wd = None
        wd = wd or _weekday_abbr_from_int(e.get("occurrence_weekday_int"))
        wd = wd or (
            e.get("occurrence_weekday")
            if isinstance(e.get("occurrence_weekday"), str)
            else None
        )
        wd = wd or _weekday_abbr_from_iso(ds)
        if not wd:
            continue

        sport_raw = e.get("sport") or e.get("sport_raw")
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


def _build_external_block(
    occurrences: List[Dict[str, Any]], week_start: Any, week_end: Any
) -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "occurrences": [
            {
                "date": o.get("date"),
                "weekday": o.get("weekday"),
                "sport_raw": o.get("sport_raw"),
                "session_sport": o.get("session_sport"),
                "title": o.get("title"),
                "duration_min": o.get("duration_min"),
                "priority": o.get("priority"),
                "start_time_local": o.get("start_time_local"),
                "notes": o.get("notes"),
                "source": o.get("source"),
                "intensity": o.get("intensity"),
                "allow_other_training": o.get("allow_other_training"),
            }
            for o in occurrences
        ],
        "window": {"from": week_start, "to": week_end},
    }


def build_daily_context_from_db(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str],
    overwrite: bool,
    user_jwt: Optional[str],
    service: bool,
) -> Dict[str, Any]:
    # ✅ AUTH FIX: service=True => jwt=None (service client)
    jwt = None if service else user_jwt

    # 1) resolve plan_id
    plan_id_effective: Optional[str] = plan_id
    resolved_via = "input"
    if not plan_id_effective:
        meta = db_get_active_plan_meta_for_user(
            user_id=user_id, user_jwt=jwt, service=service
        )
        if meta and isinstance(meta.get("plan_id"), str):
            plan_id_effective = meta["plan_id"]
            resolved_via = "active_meta"
        else:
            meta2 = db_get_latest_plan_meta_for_user(
                user_id=user_id, user_jwt=jwt, service=service
            )
            if meta2 and isinstance(meta2.get("plan_id"), str):
                plan_id_effective = meta2["plan_id"]
                resolved_via = "latest_meta"

    # 2) analyze input
    analyze_input = build_input_from_db(user_id=user_id, user_jwt=jwt, service=service)
    if not isinstance(analyze_input, dict):
        analyze_input = {}

    prefs_ai = flatten_prefs_for_ai(analyze_input)
    targets_ai = extract_targets_from_prefs(prefs_ai)

    two_a_day_cap = _two_a_day_cap_from_prefs(prefs_ai)
    long_run_days = _long_run_days_from_prefs(prefs_ai)
    strength_target = _strength_sessions_target_from_prefs(prefs_ai)

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
    external_fetch_error: Optional[str] = None

    if week_meta.get("week_start") and week_meta.get("week_end"):
        try:
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=str(week_meta["week_start"]),
                to_iso=str(week_meta["week_end"]),
                user_jwt=jwt,
                service=service,
            )
            external_occurrences_norm = _normalize_external_occurrences_from_service(
                ext_window
            )

            external_block = _build_external_block(
                external_occurrences_norm,
                week_meta["week_start"],
                week_meta["week_end"],
            )
        except Exception as e:  # noqa: BLE001
            external_block = None
            external_occurrences_norm = []
            external_fetch_error = repr(e)

    # 5) athlete_state
    state_row = db_get_latest_state_for_user(
        user_id=user_id, version=1, user_jwt=jwt, service=service
    )
    athlete_state_json = (state_row or {}).get("state_json") or None

    # 6) context payload
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
            "strength_sessions_per_week_target": strength_target,
            "external_events_must_be_included": True,
        },
    }

    if external_block is not None:
        context_payload["external_events"] = external_block
    elif external_fetch_error:
        # optional: pomôže promptu + debug
        context_payload["planning_constraints"][
            "external_events_fetch_error"
        ] = external_fetch_error

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
