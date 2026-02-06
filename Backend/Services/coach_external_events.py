from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Routes_DB.coach_external_events import (
    db_list_external_events_for_user,
    db_clear_external_events_for_user,
    db_insert_external_events,
)
from Modules.Supabase.auth import AuthCtx

# 1=Mon ... 7=Sun
INT_TO_ABBR: Dict[int, str] = {
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
    7: "Sun",
}

ABBR_TO_INT: Dict[str, int] = {
    "Mon": 1,
    "Tue": 2,
    "Wed": 3,
    "Thu": 4,
    "Fri": 5,
    "Sat": 6,
    "Sun": 7,
}

# JS/Python weekday for date.weekday(): 0=Mon..6=Sun
PY_WEEKDAY_TO_INT: Dict[int, int] = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7}


def _normalize_weekday_int(v: Any) -> Optional[int]:
    """
    Vráti 1..7 alebo None.
    Podporí:
      - int 1..7
      - string "1".."7"
      - stringy: Mon/Wed, wed, Wednesday
      - SK: pondelok, utorok, streda, štvrtok, piatok, sobota, nedeľa
    """
    if isinstance(v, bool):
        return None

    if isinstance(v, int):
        return v if 1 <= v <= 7 else None

    if isinstance(v, float) and v.is_integer():
        n = int(v)
        return n if 1 <= n <= 7 else None

    if not isinstance(v, str):
        return None

    s = v.strip().lower()
    if not s:
        return None

    if s in ("1", "2", "3", "4", "5", "6", "7"):
        return int(s)

    # EN abbrev / full
    if s.startswith("mon") or s == "monday":
        return 1
    if s.startswith("tue") or s == "tuesday":
        return 2
    if s.startswith("wed") or s == "wednesday":
        return 3
    if s.startswith("thu") or s == "thursday":
        return 4
    if s.startswith("fri") or s == "friday":
        return 5
    if s.startswith("sat") or s == "saturday":
        return 6
    if s.startswith("sun") or s == "sunday":
        return 7

    # SK (bez diakritiky aj s)
    if s in ("pondelok",):
        return 1
    if s in ("utorok",):
        return 2
    if s in ("streda",):
        return 3
    if s in ("stvrtok", "štvrtok"):
        return 4
    if s in ("piatok",):
        return 5
    if s in ("sobota",):
        return 6
    if s in ("nedela", "nedeľa"):
        return 7

    return None


def _normalize_event_input(user_id: int, ev: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizácia jedného eventu z FE.

    Nové:
      - weekday_int: 1..7 (1=Mon)
    Legacy:
      - weekday: "Mon".."Sun" alebo hocijaký text -> preložíme
    """
    recurrence_kind = (ev.get("recurrence_kind") or "weekly").lower()
    if recurrence_kind not in ("weekly", "single"):
        raise ValueError("recurrence_kind must be 'weekly' or 'single'")

    # weekday_int len pre weekly
    weekday_int: Optional[int] = None
    if recurrence_kind == "weekly":
        weekday_int = _normalize_weekday_int(ev.get("weekday_int"))
        if weekday_int is None:
            # fallback legacy field
            weekday_int = _normalize_weekday_int(ev.get("weekday"))
        if weekday_int is None:
            raise ValueError("weekday_int is required for weekly events (1=Mon..7=Sun)")

    single_date = ev.get("single_date") or None
    if recurrence_kind == "single":
        if not single_date:
            raise ValueError("single_date is required when recurrence_kind='single'")
        try:
            date.fromisoformat(single_date)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Invalid single_date: {single_date}") from exc
    else:
        # weekly -> single_date must be null
        single_date = None

    start_time_local = ev.get("start_time_local") or None

    # optional legacy weekday text for debugging/compat (not a source of truth)
    weekday_abbr = INT_TO_ABBR.get(weekday_int) if weekday_int else None

    return {
        "user_id": user_id,
        "title": str(ev.get("title") or "").strip() or "Externá aktivita",
        "sport": ev.get("sport") or None,

        # ✅ new source of truth
        "weekday_int": weekday_int,

        # optional legacy column (keep if your DB still has it)
        "weekday": weekday_abbr,

        "duration_min": int(ev["duration_min"]) if ev.get("duration_min") is not None else None,
        "priority": ev.get("priority") or "fixed",
        "notes": ev.get("notes") or None,
        "start_date": ev.get("start_date") or None,
        "end_date": ev.get("end_date") or None,
        "recurrence_kind": recurrence_kind,
        "single_date": single_date,
        "start_time_local": start_time_local,
    }


def _in_date_range(ev: Dict[str, Any], current: date) -> bool:
    start_date_str = ev.get("start_date")
    end_date_str = ev.get("end_date")

    if start_date_str:
        try:
            if date.fromisoformat(start_date_str) > current:
                return False
        except Exception:  # noqa: BLE001
            pass

    if end_date_str:
        try:
            if date.fromisoformat(end_date_str) < current:
                return False
        except Exception:  # noqa: BLE001
            pass

    return True


def _expand_events_to_window(
    events: List[Dict[str, Any]],
    date_from: date,
    date_to: date,
) -> List[Dict[str, Any]]:
    """
    Occurrence expand v [date_from, date_to].
    Používa weekday_int (1..7).
    """
    out: List[Dict[str, Any]] = []
    current = date_from

    while current <= date_to:
        iso = current.isoformat()
        wd_int = PY_WEEKDAY_TO_INT.get(current.weekday(), 1)  # 1..7
        wd_abbr = INT_TO_ABBR.get(wd_int, "Mon")

        for ev in events:
            rk = (ev.get("recurrence_kind") or "weekly").lower()

            if rk == "weekly":
                ev_wd = ev.get("weekday_int")
                if not isinstance(ev_wd, int) or not (1 <= ev_wd <= 7):
                    # fallback legacy
                    ev_wd = _normalize_weekday_int(ev.get("weekday"))
                if ev_wd != wd_int:
                    continue
                if not _in_date_range(ev, current):
                    continue

                occ = dict(ev)
                occ["occurrence_date"] = iso
                occ["occurrence_weekday_int"] = wd_int
                occ["occurrence_weekday"] = wd_abbr
                out.append(occ)

            elif rk == "single":
                sd = ev.get("single_date")
                if not sd or sd != iso:
                    continue
                if not _in_date_range(ev, current):
                    continue

                occ = dict(ev)
                occ["occurrence_date"] = iso
                occ["occurrence_weekday_int"] = wd_int
                occ["occurrence_weekday"] = wd_abbr
                out.append(occ)

        current += timedelta(days=1)

    # stabilné poradie: date, weekday_int, start_time_local
    def _sort_key(r: Dict[str, Any]):
        return (
            str(r.get("occurrence_date") or ""),
            int(r.get("occurrence_weekday_int") or 99),
            str(r.get("start_time_local") or ""),
        )

    out.sort(key=_sort_key)
    return out


def service_list_external_events_window(
    user_id: int,
    *,
    from_iso: str,
    to_iso: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    try:
        d_from = date.fromisoformat(from_iso)
        d_to = date.fromisoformat(to_iso)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid from/to date format, expected YYYY-MM-DD") from exc

    if d_to < d_from:
        raise ValueError("to must be >= from")

    base_rows = db_list_external_events_for_user(
        user_id,
        ctx=ctx,
    )

    occurrences = _expand_events_to_window(base_rows, d_from, d_to)

    return {
        "success": True,
        "occurrences": occurrences,
    }


def service_list_external_events(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    rows = db_list_external_events_for_user(
        user_id,
        ctx=ctx,
    )
    return {"success": True, "events": rows}


def service_save_external_events(
    user_id: int,
    *,
    events: List[Dict[str, Any]],
    ctx: AuthCtx,
) -> Dict[str, Any]:

    norm_rows: List[Dict[str, Any]] = []
    for raw in events:
        if not isinstance(raw, dict):
            raise ValueError("events must contain objects")
        norm_rows.append(_normalize_event_input(user_id, raw))

    deleted = db_clear_external_events_for_user(
        user_id,
        ctx=ctx,
    )

    inserted = db_insert_external_events(
        norm_rows,
        ctx=ctx,
    )

    return {
        "success": True,
        "deleted": deleted,
        "inserted": inserted,
        "count": len(norm_rows),
    }


def service_build_external_events_block_for_analysis(
    user_id: int,
    *,
    days_past: int = 28,
    days_future: int = 42,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    today = date.today()
    d_from = today - timedelta(days=days_past)
    d_to = today + timedelta(days=days_future)

    try:
        window = service_list_external_events_window(
            user_id=user_id,
            from_iso=d_from.isoformat(),
            to_iso=d_to.isoformat(),
            ctx=ctx,
        )

        raw = window.get("occurrences") or []
        occurrences: List[Dict[str, Any]] = []
        for ev in raw:
            occurrences.append(
                {
                    "occurrence_date": ev.get("occurrence_date"),
                    "occurrence_weekday_int": ev.get("occurrence_weekday_int"),
                    "occurrence_weekday": ev.get("occurrence_weekday"),
                    "sport": ev.get("sport"),
                    "title": ev.get("title"),
                    "priority": ev.get("priority") or "fixed",
                    "duration_min": ev.get("duration_min"),
                    "start_time_local": ev.get("start_time_local"),
                }
            )

        return {
            "schema_version": 1,
            "occurrences": occurrences,
            "window": {"from": d_from.isoformat(), "to": d_to.isoformat()},
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "schema_version": 1,
            "occurrences": [],
            "window": {"from": d_from.isoformat(), "to": d_to.isoformat()},
            "error": f"external_events_load_failed: {exc}",
        }