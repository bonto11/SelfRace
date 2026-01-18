# ===== Services/AI/daily_builders.py =====
from __future__ import annotations

from datetime import date, timedelta
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
# NOTE (NEW APPROACH / "A"):
# - This builder creates a STRICT week skeleton for daily planning:
#     day_constraints[] = [{date, weekday, max_sessions, locks[], lock_sessions[], open_slots, warnings[]}]
# - locks[] are NON-NEGOTIABLE (weekly_template hard slots + external events occurrences).
# - lock_sessions[] are "ready-to-insert" session objects for those locks (server can place them without AI).
# - AI will be instructed later (in prompts) to fill ONLY open slots and never touch locks.
# - FE sport enum is limited to: run/ride/strength/swim/other.
#   External events (e.g. football) => session.sport="other", payload.external_event.sport="football".
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

_TEAM_SPORTS = {
    "football",
    "soccer",
    "basketball",
    "hockey",
    "handball",
    "floorball",
    "futsal",
}

# -----------------------------------------------------------------------------
# Debug / Railway prints
# -----------------------------------------------------------------------------
# Zapneš na Railway env varom:
#   DAILY_DEBUG=1
# alebo:
#   AI_DAILY_DEBUG=1
_DEBUG_ENABLED = str(os.getenv("DAILY_DEBUG") or os.getenv("AI_DAILY_DEBUG") or "").strip().lower() in {
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
        # never fail the job because of debug printing
        pass


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


def _title_for_weekly_template_lock(sport: str, kind: str) -> str:
    sport = str(sport or "").lower()
    kind = str(kind or "").lower()
    if sport == "strength":
        return "Silový tréning (fixný deň)"
    if sport == "run" and kind == "long":
        return "Dlhý beh"
    if sport == "run" and kind in {"interval", "intervals"}:
        return "Intervalový tréning"
    if sport == "run" and kind in {"tempo", "threshold"}:
        return "Tempový beh"
    if sport == "ride":
        return "Cyklistika"
    if sport == "swim":
        return "Plávanie"
    return "Tréning (fixný deň)"


def _duration_hint_for_weekly_template_lock(sport: str, kind: str) -> Optional[int]:
    """
    Len hint (AI / server), finálne si to vie upraviť AI.
    Strength má neskôr hard-normalizer na 75 min v daily_plan service.
    """
    sport = str(sport or "").lower()
    kind = str(kind or "").lower()
    if sport == "strength":
        return 75
    if sport == "run" and kind == "long":
        return 90
    return None


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


# -------------------------
# Weekly template -> HARD locks
# -------------------------

def _derive_hard_fixed_slots_from_weekly_template(
    weekly_template: Dict[str, Any],
    max_fixed: int = 14,
) -> List[Dict[str, Any]]:
    """
    Extract HARD fixed slots from weekly_template:
      - priority == "key"
      - ai_can_move == False
    """
    if not isinstance(weekly_template, dict):
        return []

    days = weekly_template.get("days")
    if not isinstance(days, list):
        return []

    ordered_days: List[Dict[str, Any]] = sorted(
        (d for d in days if isinstance(d, dict) and isinstance(d.get("day"), str)),
        key=lambda d: WEEKDAY_ORDER.get(str(d.get("day") or ""), 99),
    )

    out: List[Dict[str, Any]] = []
    for d in ordered_days:
        wd = str(d.get("day") or "")
        if wd not in WEEKDAY_ORDER:
            continue

        slots = d.get("slots") or []
        if not isinstance(slots, list):
            continue

        for s in slots:
            if not isinstance(s, dict):
                continue
            if s.get("priority") != "key":
                continue
            if s.get("ai_can_move") is not False:
                continue  # only HARD

            sport = s.get("sport")
            kind = s.get("kind")
            if not sport or not kind:
                continue

            out.append(
                {
                    "weekday": wd,
                    "sport": str(sport),
                    "kind": str(kind),
                    "priority": "key",
                    "policy": "hard",
                    "source": "weekly_template",
                }
            )
            if len(out) >= max_fixed:
                return out

    return out


# -------------------------
# External events -> normalized occurrences
# -------------------------

def _normalize_external_occurrences_from_service(ext_window: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    service_list_external_events_window returns:
      {"success": True, "events": [ { ... "occurrence_date": "YYYY-MM-DD", ... } ]}
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
        out.append(
            {
                "date": ds,
                "weekday": wd,
                "sport_raw": sport_raw,
                "session_sport": _coerce_session_sport(sport_raw),
                "title": e.get("title") or "Externá aktivita",
                "duration_min": e.get("duration_min"),
                "priority": e.get("priority") or "optional",
                "start_time_local": e.get("start_time_local"),
                "notes": e.get("notes"),
                "source": "external_events",
                "policy": "hard",
            }
        )

    return out


# -------------------------
# Day constraints = WEEK SKELETON
# -------------------------

def _build_lock_session_from_weekly_template(lock: Dict[str, Any]) -> Dict[str, Any]:
    sport = _coerce_session_sport(lock.get("sport"))
    kind = str(lock.get("kind") or "full")
    wd = str(lock.get("weekday") or "")
    duration_hint = _duration_hint_for_weekly_template_lock(sport, kind)

    sess: Dict[str, Any] = {
        "sport": sport,
        "title": _title_for_weekly_template_lock(sport, kind),
        "duration_min": duration_hint,
        "intensity": None,
        "session_type": None,
        "zone_text": None,
        "notes": "Fixný slot z weekly_template.",
        "structure": {},
        "payload": {
            "fixed_slot": {
                "weekday": wd,
                "sport": str(lock.get("sport") or sport),
                "kind": kind,
                "policy": "hard",
            }
        },
    }
    if sess["duration_min"] is None:
        sess.pop("duration_min", None)
    return sess


def _build_lock_session_from_external_event(lock: Dict[str, Any]) -> Dict[str, Any]:
    session_sport = _coerce_session_sport(lock.get("session_sport") or lock.get("sport_raw"))
    sport_raw = str(lock.get("sport_raw") or "")
    title = lock.get("title") or "Externá aktivita"
    duration_min = lock.get("duration_min")

    sess: Dict[str, Any] = {
        "sport": session_sport,
        "title": title,
        "duration_min": duration_min if isinstance(duration_min, (int, float)) else None,
        "intensity": None,
        "session_type": "external_event",
        "zone_text": None,
        "notes": "Externá udalosť (fixná).",
        "structure": {},
        "payload": {
            "external_event": {
                "date": lock.get("date"),
                "title": title,
                "sport": sport_raw or None,
                "start_time_local": lock.get("start_time_local"),
                "duration_min": duration_min if isinstance(duration_min, (int, float)) else None,
                "priority": lock.get("priority"),
            }
        },
    }
    if sess["duration_min"] is None:
        sess.pop("duration_min", None)
    return sess


def _build_day_constraints_for_week(
    *,
    week_start_iso: str,
    week_end_iso: str,
    prefs_ai: Dict[str, Any],
    weekly_template: Dict[str, Any],
    external_occurrences: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    try:
        d0 = date.fromisoformat(str(week_start_iso)[:10])
        d1 = date.fromisoformat(str(week_end_iso)[:10])
    except Exception:
        _dprint("day_constraints: invalid week_start/week_end", week_start_iso, week_end_iso)
        return []

    if d1 < d0:
        _dprint("day_constraints: week_end < week_start", d0, d1)
        return []

    pref_obj = (prefs_ai.get("preferences") or {}) if isinstance(prefs_ai, dict) else {}
    avoid_two_a_day = bool(pref_obj.get("avoid_two_a_day"))
    base_max = 1 if avoid_two_a_day else 2

    hard_fixed = _derive_hard_fixed_slots_from_weekly_template(weekly_template)
    _dprint("weekly_template hard_fixed:", len(hard_fixed), "| avoid_two_a_day:", avoid_two_a_day, "| base_max:", base_max)

    fixed_by_wd: Dict[str, List[Dict[str, Any]]] = {}
    for fs in hard_fixed:
        wd = fs.get("weekday")
        if isinstance(wd, str) and wd:
            fixed_by_wd.setdefault(wd, []).append(fs)

    ext_by_date: Dict[str, List[Dict[str, Any]]] = {}
    for ev in external_occurrences:
        ds = ev.get("date")
        if isinstance(ds, str) and ds:
            ext_by_date.setdefault(ds[:10], []).append(ev)

    out: List[Dict[str, Any]] = []
    cur = d0
    while cur <= d1:
        ds = cur.isoformat()
        wd = _WEEKDAY_TO_ABBR.get(cur.weekday())
        if not wd:
            cur += timedelta(days=1)
            continue

        locks: List[Dict[str, Any]] = []
        lock_sessions: List[Dict[str, Any]] = []
        warnings: List[str] = []

        # weekly_template hard locks
        for fs in fixed_by_wd.get(wd, []):
            lock = {
                "source": "weekly_template",
                "policy": "hard",
                "date": ds,
                "weekday": wd,
                "sport": fs.get("sport"),
                "kind": fs.get("kind"),
                "priority": "key",
            }
            locks.append(lock)
            lock_sessions.append(_build_lock_session_from_weekly_template(lock))

        # external hard locks
        for ev in ext_by_date.get(ds, []):
            lock = {
                "source": "external_events",
                "policy": "hard",
                "date": ds,
                "weekday": wd,
                "session_sport": ev.get("session_sport"),
                "sport_raw": ev.get("sport_raw"),
                "kind": "external",
                "title": ev.get("title"),
                "duration_min": ev.get("duration_min"),
                "priority": ev.get("priority"),
                "start_time_local": ev.get("start_time_local"),
            }
            locks.append(lock)
            lock_sessions.append(_build_lock_session_from_external_event(lock))

        max_sessions = base_max

        # long run fixed day => only this training
        if any(
            (l.get("source") == "weekly_template" and l.get("sport") == "run" and l.get("kind") == "long")
            for l in locks
        ):
            max_sessions = 1

        # team sport external => only this training
        if any(
            (str(l.get("sport_raw") or "").lower() in _TEAM_SPORTS) and l.get("source") == "external_events"
            for l in locks
        ):
            max_sessions = 1

        if avoid_two_a_day:
            max_sessions = 1

        open_slots = int(max_sessions) - len(locks)
        if open_slots < 0:
            warnings.append(f"locks_exceed_max_sessions: locks={len(locks)} max_sessions={int(max_sessions)}")
            open_slots = 0

        out.append(
            {
                "date": ds,
                "weekday": wd,
                "max_sessions": int(max_sessions),
                "locks": locks,
                "lock_sessions": lock_sessions,
                "open_slots": int(open_slots),
                "warnings": warnings,
            }
        )

        cur += timedelta(days=1)

    if _DEBUG_ENABLED:
        # concise week summary: date -> (max, locks, open)
        summary = ", ".join(
            f"{d['date']}:{int(d['max_sessions'])}/{len(d.get('locks') or [])}/{int(d['open_slots'])}"
            for d in out
        )
        _dprint("day_constraints summary (date:max/locks/open):", summary)

    return out


# -------------------------
# Context builder
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
    _dprint(
        "prefs: main_sport=",
        (prefs_ai.get("main_sport") if isinstance(prefs_ai, dict) else None),
        "| avoid_two_a_day=",
        bool(pref_obj.get("avoid_two_a_day")),
        "| has_weekly_template=",
        isinstance((prefs_ai.get("weekly_template") if isinstance(prefs_ai, dict) else None), dict),
    )

    weekly_template: Dict[str, Any] = {}
    if isinstance(prefs_ai, dict):
        wt = prefs_ai.get("weekly_template")
        if isinstance(wt, dict):
            weekly_template = wt

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
            "WARNING: week_row is None/empty -> day_constraints WILL BE EMPTY. "
            "This is the #1 reason you get only a few sessions (AI decides freely). "
            "Check DB: coach_plan_weekly row exists for plan_id+week_index."
        )
    else:
        _dprint(
            "week_row found | week_start=",
            week_row.get("week_start"),
            "| week_end=",
            week_row.get("week_end"),
            "| focus=",
            week_row.get("focus"),
            "| load_phase=",
            week_row.get("load_phase"),
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

    # 4) external occurrences (normalized)
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
            _dprint("external_events: raw_success=", ext_window.get("success"), "| events_in=", len(ext_window.get("events") or []))
            _dprint("external_events: normalized_occurrences=", len(external_occurrences_norm))

            # kept for debug/transparency
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

    # 5) day_constraints (WEEK SKELETON)
    day_constraints: List[Dict[str, Any]] = []
    if week_meta.get("week_start") and week_meta.get("week_end"):
        day_constraints = _build_day_constraints_for_week(
            week_start_iso=str(week_meta["week_start"]),
            week_end_iso=str(week_meta["week_end"]),
            prefs_ai=prefs_ai if isinstance(prefs_ai, dict) else {},
            weekly_template=weekly_template,
            external_occurrences=external_occurrences_norm,
        )
        _dprint("day_constraints built:", len(day_constraints))
    else:
        _dprint("day_constraints: EMPTY (missing week_start/week_end)")

    # 6) athlete_state
    state_row = db_get_latest_state_for_user(
        user_id=user_id,
        version=1,
        user_jwt=jwt,
        service=service,
    )
    athlete_state_json = (state_row or {}).get("state_json") or None
    _dprint("athlete_state:", "present" if athlete_state_json else "missing", "| state_row_id=", (state_row or {}).get("id"))

    # 7) context payload for AI / services
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
        "weekly_template": weekly_template,
        "day_constraints": day_constraints,  # strict skeleton
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
        "| day_constraints=",
        len(day_constraints),
        "| external_occurrences=",
        len(external_occurrences_norm),
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
        "weekly_template": weekly_template,
        "analyze_input": analyze_input,
    }