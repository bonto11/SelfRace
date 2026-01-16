# Services/AI/daily_builders.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import date, timedelta

from Services.AI.athlete_state_builders import build_input_from_db
from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_weekly import db_get_week_row_for_plan
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Services.coach_external_events import service_list_external_events_window


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


def _weekday_abbr_from_iso(d: str) -> Optional[str]:
    if not isinstance(d, str) or not d:
        return None
    try:
        dd = date.fromisoformat(d[:10])
        return _WEEKDAY_TO_ABBR.get(dd.weekday())
    except Exception:
        return None


def _is_same_fixed_slot(session: Dict[str, Any], slot: Dict[str, Any]) -> bool:
    """
    Match podľa payload.fixed_slot (preferované), fallback podľa sport/kind.
    """
    payload = session.get("payload") or {}
    fs = payload.get("fixed_slot") or {}
    if isinstance(fs, dict) and fs.get("weekday") == slot.get("weekday") and fs.get("sport") == slot.get("sport"):
        # kind je voliteľný match (niekedy LLM kind nedá)
        if slot.get("kind") and fs.get("kind"):
            return fs.get("kind") == slot.get("kind")
        return True
    return False


def _make_placeholder_for_slot(slot: Dict[str, Any]) -> Dict[str, Any]:
    """
    Bezpečný placeholder, keď AI slot nedala vôbec.
    """
    sport = slot.get("sport") or "other"
    kind = slot.get("kind") or None
    weekday = slot.get("weekday")
    policy = slot.get("policy") or "hard"

    if sport == "strength":
        return {
            "sport": "strength",
            "title": "Silový tréning (fixný deň)",
            "duration_min": 75 if kind == "full" else 50,
            "intensity": "moderate",
            "session_type": "coach_override",
            "zone_text": None,
            "notes": (
                "Fixný slot z weekly template. AI ho na tento deň nedala, "
                "preto je tu bezpečný placeholder. Drž deň, ale prispôsob intenzitu podľa únavy."
            ),
            "structure": {},
            "payload": {
                "fixed_slot": {
                    "weekday": weekday,
                    "sport": "strength",
                    "kind": kind,
                    "policy": policy,
                }
            },
        }

    if sport == "run" and kind == "long":
        return {
            "sport": "run",
            "title": "Dlhý beh (fixný deň)",
            "duration_min": 80,
            "intensity": "Z2",
            "session_type": "coach_override",
            "zone_text": "Zóna 2",
            "notes": (
                "Fixný slot z weekly template. AI ho na tento deň nedala, "
                "preto je tu bezpečný placeholder. Drž deň, ale skráť ak si rozbitý."
            ),
            "structure": {},
            "payload": {
                "fixed_slot": {
                    "weekday": weekday,
                    "sport": "run",
                    "kind": "long",
                    "policy": policy,
                }
            },
        }

    # generic
    return {
        "sport": sport,
        "title": "Fixný tréning",
        "duration_min": 45,
        "intensity": None,
        "session_type": "coach_override",
        "zone_text": None,
        "notes": "Fixný slot z weekly template – placeholder.",
        "structure": {},
        "payload": {"fixed_slot": {"weekday": weekday, "sport": sport, "kind": kind, "policy": policy}},
    }


def enforce_fixed_slots_on_daily_plan(
    daily_plan: Dict[str, Any],
    fixed_slots: List[Dict[str, Any]],
    strength_target: Optional[int],
) -> Dict[str, Any]:
    """
    Robustná verzia:
    1) Opraví zle umiestnené fixed-slot sessions (MOVE na správny deň podľa payload.fixed_slot.weekday)
    2) Až potom doplní chýbajúce fixed slots placeholderom
    3) Keď strength_target je pokrytý hard fixed strength slotmi, zmaže extra strength bez fixed_slot
    """
    days = daily_plan.get("days")
    if not isinstance(days, list) or not fixed_slots:
        return daily_plan

    # map date -> day obj + weekday abbr
    date_to_day: Dict[str, Dict[str, Any]] = {}
    date_to_wd: Dict[str, str] = {}
    for d in days:
        ds = d.get("date")
        if not isinstance(ds, str):
            continue
        wd = _weekday_abbr_from_iso(ds)
        if not wd:
            continue
        date_to_day[ds] = d
        date_to_wd[ds] = wd
        if not isinstance(d.get("sessions"), list):
            d["sessions"] = []

    # map weekday abbr -> date (v danom týždni je unikátne)
    wd_to_date: Dict[str, str] = {}
    for ds, wd in date_to_wd.items():
        wd_to_date[wd] = ds

    # ------------- 1) MOVE všetkých session s payload.fixed_slot na správny deň -------------
    for d in days:
        ds = d.get("date")
        if not isinstance(ds, str):
            continue
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            continue

        keep: List[Dict[str, Any]] = []
        to_move: List[Tuple[str, Dict[str, Any]]] = []

        for s in sessions:
            if not isinstance(s, dict):
                continue
            payload = s.get("payload") or {}
            fs = payload.get("fixed_slot") or {}
            if isinstance(fs, dict) and isinstance(fs.get("weekday"), str):
                target_wd = fs["weekday"]
                target_date = wd_to_date.get(target_wd)
                # ak viem target date a je to INÝ deň, move
                if target_date and target_date != ds:
                    to_move.append((target_date, s))
                    continue
            keep.append(s)

        d["sessions"] = keep

        # vykonaj presuny
        for target_date, sess in to_move:
            target_day = date_to_day.get(target_date)
            if not target_day:
                continue
            if not isinstance(target_day.get("sessions"), list):
                target_day["sessions"] = []
            target_day["sessions"].append(sess)

    # ------------- 2) Dedup fixed slots + doplnenie chýbajúcich placeholderom -------------
    def slot_key(slot: Dict[str, Any]) -> Tuple[str, str, str, str]:
        return (
            str(slot.get("weekday") or ""),
            str(slot.get("sport") or ""),
            str(slot.get("kind") or ""),
            str(slot.get("policy") or ""),
        )

    found_by_key: Dict[Tuple[str, str, str, str], List[Tuple[str, Dict[str, Any]]]] = {}
    for d in days:
        ds = d.get("date")
        if not isinstance(ds, str):
            continue
        for s in (d.get("sessions") or []):
            if not isinstance(s, dict):
                continue
            payload = s.get("payload") or {}
            fs = payload.get("fixed_slot") or {}
            if not isinstance(fs, dict):
                continue
            k = (
                str(fs.get("weekday") or ""),
                str(fs.get("sport") or ""),
                str(fs.get("kind") or ""),
                str(fs.get("policy") or ""),
            )
            if k[0] and k[1]:
                found_by_key.setdefault(k, []).append((ds, s))

    for slot in fixed_slots:
        if slot.get("policy") != "hard":
            continue

        k = slot_key(slot)
        wd = slot.get("weekday")
        target_date = wd_to_date.get(str(wd))

        if not target_date:
            continue

        matches = found_by_key.get(k, [])

        if len(matches) > 1:
            matches_sorted = sorted(matches, key=lambda x: 0 if x[0] == target_date else 1)
            keep_ds, keep_sess = matches_sorted[0]

            for ds2, s2 in matches_sorted[1:]:
                p = s2.get("payload") or {}
                if isinstance(p, dict) and "fixed_slot" in p:
                    p.pop("fixed_slot", None)
                    s2["payload"] = p

            found_by_key[k] = [(keep_ds, keep_sess)]
            matches = [(keep_ds, keep_sess)]

        if not matches:
            day_obj = date_to_day.get(target_date)
            if not day_obj:
                continue
            day_obj["sessions"].append(_make_placeholder_for_slot(slot))
            continue

        ds_found, sess_found = matches[0]
        if ds_found != target_date:
            old_day = date_to_day.get(ds_found)
            if old_day and isinstance(old_day.get("sessions"), list):
                old_day["sessions"] = [x for x in old_day["sessions"] if x is not sess_found]
            date_to_day[target_date]["sessions"].append(sess_found)

    # ------------- 3) Ak strength_target je pokrytý hard fixed strength slotmi -> odstráň extra strength bez fixed_slot -------------
    hard_strength_slots = [s for s in fixed_slots if s.get("policy") == "hard" and s.get("sport") == "strength"]
    if isinstance(strength_target, int) and strength_target > 0 and len(hard_strength_slots) >= strength_target:
        for d in days:
            sessions = d.get("sessions") or []
            if not isinstance(sessions, list):
                continue
            filtered: List[Dict[str, Any]] = []
            for s in sessions:
                if not isinstance(s, dict):
                    continue
                if s.get("sport") != "strength":
                    filtered.append(s)
                    continue
                payload = s.get("payload") or {}
                fs = payload.get("fixed_slot") or {}
                if isinstance(fs, dict) and fs.get("sport") == "strength":
                    filtered.append(s)
                    continue
            d["sessions"] = filtered

    return daily_plan


# -------------------------
# NEW: fixed slots + day constraints
# -------------------------

def _derive_hard_fixed_slots_from_weekly_template(weekly_template: Dict[str, Any], max_fixed: int = 14) -> List[Dict[str, Any]]:
    """
    Z weekly_template vyberie len HARD fixed sloty:
      - priority == "key"
      - ai_can_move == False

    Výstup je stabilný, AI-friendly:
    {weekday, sport, kind, priority, policy="hard", source="weekly_template"}
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
                continue  # berieme iba HARD

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


def _normalize_external_occurrences_from_service(ext_window: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    service_list_external_events_window dnes vracia:
      {"success": True, "events": [ { ... "occurrence_date": "YYYY-MM-DD", ... } ]}

    My to normalizujeme na:
      {date, weekday, sport, title, duration_min, priority, start_time_local, source="external_events", policy="hard"}
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
        wd = _weekday_abbr_from_iso(occ_date)
        if not wd:
            continue

        out.append(
            {
                "date": occ_date[:10],
                "weekday": wd,
                "sport": e.get("sport"),
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


def _build_day_constraints_for_week(
    *,
    week_start_iso: str,
    week_end_iso: str,
    prefs_ai: Dict[str, Any],
    weekly_template: Dict[str, Any],
    external_occurrences: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Vytvorí 7-dňový constraint zoznam:
      - date, weekday
      - max_sessions (1/2)
      - locks (hard fixed slots + external occurrences)

    Pravidlá:
      - ak prefs.preferences.avoid_two_a_day == True -> max_sessions=1 pre každý deň
      - long run hard fixed -> max_sessions=1
      - team šport external (football) -> max_sessions=1
    """
    try:
        d0 = date.fromisoformat(week_start_iso[:10])
        d1 = date.fromisoformat(week_end_iso[:10])
    except Exception:
        return []

    if d1 < d0:
        return []

    pref_obj = (prefs_ai.get("preferences") or {}) if isinstance(prefs_ai, dict) else {}
    avoid_two_a_day = bool(pref_obj.get("avoid_two_a_day"))

    base_max = 1 if avoid_two_a_day else 2

    hard_fixed = _derive_hard_fixed_slots_from_weekly_template(weekly_template)

    # index fixed by weekday
    fixed_by_wd: Dict[str, List[Dict[str, Any]]] = {}
    for fs in hard_fixed:
        wd = fs.get("weekday")
        if isinstance(wd, str):
            fixed_by_wd.setdefault(wd, []).append(fs)

    # index externals by date
    ext_by_date: Dict[str, List[Dict[str, Any]]] = {}
    for ev in external_occurrences:
        ds = ev.get("date")
        if isinstance(ds, str):
            ext_by_date.setdefault(ds[:10], []).append(ev)

    TEAM_SPORTS = {"football", "soccer", "basketball", "hockey", "handball", "floorball", "futsal"}

    out: List[Dict[str, Any]] = []
    cur = d0
    while cur <= d1:
        ds = cur.isoformat()
        wd = _WEEKDAY_TO_ABBR.get(cur.weekday())
        if not wd:
            cur += timedelta(days=1)
            continue

        locks: List[Dict[str, Any]] = []

        # fixed slots for this weekday
        for fs in fixed_by_wd.get(wd, []):
            locks.append(
                {
                    "sport": fs.get("sport"),
                    "kind": fs.get("kind"),
                    "weekday": wd,
                    "date": ds,
                    "source": fs.get("source") or "weekly_template",
                    "policy": "hard",
                }
            )

        # external occurrences on this date
        for ev in ext_by_date.get(ds, []):
            locks.append(
                {
                    "sport": ev.get("sport"),
                    "kind": "external",
                    "weekday": wd,
                    "date": ds,
                    "title": ev.get("title"),
                    "duration_min": ev.get("duration_min"),
                    "priority": ev.get("priority"),
                    "start_time_local": ev.get("start_time_local"),
                    "source": "external_events",
                    "policy": "hard",
                }
            )

        # decide max sessions
        max_sessions = base_max

        # long run fixed day => only this training
        if any((l.get("sport") == "run" and l.get("kind") == "long") for l in locks):
            max_sessions = 1

        # team sport external => only this training
        if any((str(l.get("sport") or "").lower() in TEAM_SPORTS) and l.get("source") == "external_events" for l in locks):
            max_sessions = 1

        # if user forbids two-a-day => always 1
        if avoid_two_a_day:
            max_sessions = 1

        out.append(
            {
                "date": ds,
                "weekday": wd,
                "max_sessions": max_sessions,
                "locks": locks,
            }
        )

        cur += timedelta(days=1)

    return out


def build_daily_rows_from_ai(
    user_id: int,
    plan_id: Optional[str],
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Preklopí AI výstup (daily_plan JSON – už po obohatení strength mapperom)
    do rows pre coach_plan_daily.
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

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str,
                "sport": s.get("sport") or "other",
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


def flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    build_input_from_db vracia:
      "prefs": { "value": { ... } } alebo už čistý dict.
    Chceme pre AI čistý dict bez 'value' obalu.
    """
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        return raw["value"]
    return raw if isinstance(raw, dict) else {}


def extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Vytiahne prefs.targets ako dict.
    """
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


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

    plan_id_effective: Optional[str] = plan_id
    if not plan_id_effective:
        meta = db_get_active_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        ) or db_get_latest_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=service,
        )
        if meta and isinstance(meta.get("plan_id"), str):
            plan_id_effective = meta["plan_id"]

    analyze_input = build_input_from_db(
        user_id=user_id,
        user_jwt=jwt,
        service=service,
    )

    prefs_ai = flatten_prefs_for_ai(analyze_input)
    targets_ai = extract_targets_from_prefs(prefs_ai)

    weekly_template: Dict[str, Any] = {}
    if isinstance(prefs_ai, dict):
        wt = prefs_ai.get("weekly_template")
        if isinstance(wt, dict):
            weekly_template = wt

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

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

    # --- external occurrences pre tento tyzden (AI-friendly) ---
    external_block: Optional[Dict[str, Any]] = None
    external_occurrences_norm: List[Dict[str, Any]] = []

    if week_meta["week_start"] and week_meta["week_end"]:
        try:
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=week_meta["week_start"],
                to_iso=week_meta["week_end"],
                user_jwt=jwt,
                service=service,
            )

            external_occurrences_norm = _normalize_external_occurrences_from_service(ext_window)

            # posielame do contextu AI-friendly occurrences
            external_block = {
                "schema_version": 1,
                "occurrences": [
                    {
                        "date": e.get("date"),
                        "weekday": e.get("weekday"),
                        "sport": e.get("sport"),
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
        except Exception:
            external_block = None
            external_occurrences_norm = []

    # --- day constraints (date-based, no ambiguity) ---
    day_constraints: List[Dict[str, Any]] = []
    if week_meta.get("week_start") and week_meta.get("week_end"):
        day_constraints = _build_day_constraints_for_week(
            week_start_iso=str(week_meta["week_start"]),
            week_end_iso=str(week_meta["week_end"]),
            prefs_ai=prefs_ai if isinstance(prefs_ai, dict) else {},
            weekly_template=weekly_template,
            external_occurrences=external_occurrences_norm,
        )

    state_row = db_get_latest_state_for_user(
        user_id=user_id,
        version=1,
        user_jwt=jwt,
        service=service,
    )
    athlete_state_json = (state_row or {}).get("state_json") or None

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
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
        "day_constraints": day_constraints,  # <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< NEW
    }
    if external_block is not None:
        context_payload["external_events"] = external_block

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