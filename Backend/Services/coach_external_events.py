# Services/coach_external_events.py
from __future__ import annotations

from typing import Any, Dict, List
from datetime import date, timedelta

from Routes_DB.coach_external_events import (
    db_list_external_events_for_user,
    db_clear_external_events_for_user,
    db_insert_external_events,
)


def _normalize_event_input(
    user_id: int,
    ev: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Normalizácia jedného eventu z FE.
    Očakáva:
      - weekday (1–7)
      - recurrence_kind ("weekly" | "single")
      - single_date (pri single)
      - start_time_local (voliteľné)
      - ostatné polia ako doteraz
    """
    weekday = int(ev.get("weekday") or 0)
    if weekday < 1 or weekday > 7:
        raise ValueError("weekday must be between 1 and 7")

    recurrence_kind = (ev.get("recurrence_kind") or "weekly").lower()
    if recurrence_kind not in ("weekly", "single"):
        raise ValueError("recurrence_kind must be 'weekly' or 'single'")

    # single_date ako ISO "YYYY-MM-DD" alebo None
    single_date = ev.get("single_date") or None
    if single_date:
        try:
            # validácia formátu – ak zlyhá, vyhodíme 400
            date.fromisoformat(single_date)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Invalid single_date: {single_date}") from exc

    start_time_local = ev.get("start_time_local") or None
    # (tu by sa dala riešiť validácia "HH:MM", ale zatiaľ soft)

    return {
        "user_id": user_id,
        "title": str(ev.get("title") or "").strip() or "Externá aktivita",
        "sport": ev.get("sport") or None,
        "weekday": weekday,
        "duration_min": (
            int(ev["duration_min"]) if ev.get("duration_min") is not None else None
        ),
        "priority": ev.get("priority") or "fixed",
        "notes": ev.get("notes") or None,
        "start_date": ev.get("start_date") or None,
        "end_date": ev.get("end_date") or None,
        "recurrence_kind": recurrence_kind,
        "single_date": single_date,
        "start_time_local": start_time_local,
    }


def _expand_events_to_window(
    events: List[Dict[str, Any]],
    date_from: date,
    date_to: date,
) -> List[Dict[str, Any]]:
    """
    Zoberie zoznam definícií eventov (weekly/single) a vygeneruje konkrétne
    "výskyty" v [date_from, date_to].

    Každý výsledný dict má navyše k DB poliam aj:
      - "occurrence_date": ISO "YYYY-MM-DD"
    """
    out: List[Dict[str, Any]] = []

    # helper: mapping 1–7 (Mon..Sun) -> python weekday 0..6
    def weekday_db_to_py(db_weekday: int) -> int:
        # DB: 1=Mon..7=Sun, python: 0=Mon..6=Sun
        if db_weekday == 7:
            return 6
        return db_weekday - 1

    current = date_from
    while current <= date_to:
        py_wd = current.weekday()  # 0..6
        iso = current.isoformat()

        for ev in events:
            rk = (ev.get("recurrence_kind") or "weekly").lower()

            # weekly event
            if rk == "weekly":
                db_wd = int(ev.get("weekday") or 0)
                if db_wd < 1 or db_wd > 7:
                    continue

                # kontrola weekday
                if weekday_db_to_py(db_wd) != py_wd:
                    continue

                # start_date / end_date okno
                start_date_str = ev.get("start_date")
                end_date_str = ev.get("end_date")

                if start_date_str:
                    try:
                        if date.fromisoformat(start_date_str) > current:
                            continue
                    except Exception:  # noqa: BLE001
                        pass

                if end_date_str:
                    try:
                        if date.fromisoformat(end_date_str) < current:
                            continue
                    except Exception:  # noqa: BLE001
                        pass

                occ = dict(ev)
                occ["occurrence_date"] = iso
                out.append(occ)

            # single event
            elif rk == "single":
                single_date = ev.get("single_date")
                if not single_date:
                    continue
                if single_date != iso:
                    continue

                occ = dict(ev)
                occ["occurrence_date"] = iso
                out.append(occ)

        current += timedelta(days=1)

    return out


def service_list_external_events_window(
    user_id: int,
    *,
    from_iso: str,
    to_iso: str,
) -> Dict[str, Any]:
    """
    Vráti externé eventy expandované na konkrétne dni v zadanom okne.
    """
    try:
        d_from = date.fromisoformat(from_iso)
        d_to = date.fromisoformat(to_iso)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid from/to date format, expected YYYY-MM-DD") from exc

    if d_to < d_from:
        raise ValueError("to must be >= from")

    base_rows = db_list_external_events_for_user(user_id)
    occurrences = _expand_events_to_window(base_rows, d_from, d_to)

    return {
        "success": True,
        "events": occurrences,
    }


def service_list_external_events(user_id: int) -> Dict[str, Any]:
    """
    Vráti zoznam externých eventov pre usera (holé definície, bez expandovania).
    """
    rows = db_list_external_events_for_user(user_id)
    return {
        "success": True,
        "events": rows,
    }


def service_save_external_events(
    user_id: int,
    *,
    events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Overwrite save:
      - zmaže všetky existujúce eventy usera
      - vloží nové podľa payloadu
    """
    norm_rows: List[Dict[str, Any]] = []
    for raw in events:
        norm_rows.append(_normalize_event_input(user_id, raw))

    # vyčisti existujúce eventy
    deleted = db_clear_external_events_for_user(user_id)

    # insert new
    inserted = db_insert_external_events(norm_rows)

    return {
        "success": True,
        "deleted": deleted,
        "inserted": inserted,
        "count": len(norm_rows),
    }
