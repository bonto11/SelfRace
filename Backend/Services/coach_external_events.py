from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from Routes_DB.coach_external_events import (
    db_list_external_events_for_user,
    db_clear_external_events_for_user,
    db_insert_external_events,
)
from Services.users import require_jwt

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


def _normalize_weekday_abbr(v: Any) -> str:
    if not isinstance(v, str):
        return ""
    s = v.strip()
    # normalizuj kapitalizáciu (Mon, Tue...)
    if len(s) < 3:
        return ""
    s3 = s[:3].title()
    return s3 if s3 in WEEKDAY_ORDER else ""


def _normalize_event_input(user_id: int, ev: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizácia jedného eventu z FE.

    Očakáva:
      - weekday: "Mon".."Sun"  (ty chceš "Wed" -> toto je správne)
      - recurrence_kind: "weekly" | "single"
      - single_date pri single
      - start_time_local voliteľné
    """
    weekday = _normalize_weekday_abbr(ev.get("weekday"))
    if not weekday:
        raise ValueError("weekday must be one of: Mon, Tue, Wed, Thu, Fri, Sat, Sun")

    recurrence_kind = (ev.get("recurrence_kind") or "weekly").lower()
    if recurrence_kind not in ("weekly", "single"):
        raise ValueError("recurrence_kind must be 'weekly' or 'single'")

    single_date = ev.get("single_date") or None
    if single_date:
        try:
            date.fromisoformat(single_date)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Invalid single_date: {single_date}") from exc

    start_time_local = ev.get("start_time_local") or None

    return {
        "user_id": user_id,
        "title": str(ev.get("title") or "").strip() or "Externá aktivita",
        "sport": ev.get("sport") or None,
        "weekday": weekday,  # TEXT "Wed"
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
    Vygeneruje konkrétne výskyty v [date_from, date_to].

    Každý výsledok obsahuje:
      - occurrence_date: "YYYY-MM-DD"
      - occurrence_weekday: "Mon".."Sun"
    """
    out: List[Dict[str, Any]] = []
    current = date_from

    while current <= date_to:
        iso = current.isoformat()
        wd_abbr = _WEEKDAY_TO_ABBR.get(current.weekday())  # 0..6 -> "Mon".. "Sun"

        for ev in events:
            rk = (ev.get("recurrence_kind") or "weekly").lower()

            if rk == "weekly":
                ev_wd = _normalize_weekday_abbr(ev.get("weekday"))
                if not ev_wd:
                    continue
                if ev_wd != wd_abbr:
                    continue
                if not _in_date_range(ev, current):
                    continue

                occ = dict(ev)
                occ["occurrence_date"] = iso
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
                occ["occurrence_weekday"] = wd_abbr
                out.append(occ)

        current += timedelta(days=1)

    # stabilné poradie: podľa dátumu, potom weekday poradia
    out.sort(
        key=lambda r: (
            str(r.get("occurrence_date") or ""),
            WEEKDAY_ORDER.get(str(r.get("occurrence_weekday") or ""), 99),
        )
    )
    return out


def service_list_external_events_window(
    user_id: int,
    *,
    from_iso: str,
    to_iso: str,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vracia expandnuté occurrences pre okno.
    """
    try:
        d_from = date.fromisoformat(from_iso)
        d_to = date.fromisoformat(to_iso)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid from/to date format, expected YYYY-MM-DD") from exc

    if d_to < d_from:
        raise ValueError("to must be >= from")

    jwt = None if service else require_jwt(user_jwt)

    base_rows = db_list_external_events_for_user(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    occurrences = _expand_events_to_window(base_rows, d_from, d_to)

    return {
        "success": True,
        "occurrences": occurrences,  # <- kľúčové: occurrences
    }


def service_list_external_events(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    jwt = None if service else require_jwt(user_jwt)

    rows = db_list_external_events_for_user(
        user_id,
        user_jwt=jwt,
        service=service,
    )
    return {"success": True, "events": rows}


def service_save_external_events(
    user_id: int,
    *,
    events: List[Dict[str, Any]],
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    jwt = None if service else require_jwt(user_jwt)

    norm_rows: List[Dict[str, Any]] = []
    for raw in events:
        norm_rows.append(_normalize_event_input(user_id, raw))

    deleted = db_clear_external_events_for_user(
        user_id,
        user_jwt=jwt,
        service=service,
    )

    inserted = db_insert_external_events(
        norm_rows,
        user_jwt=jwt,
        service=service,
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
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Blok pre analyze/weekly/daily – AI-friendly.
    """
    today = date.today()
    d_from = today - timedelta(days=days_past)
    d_to = today + timedelta(days=days_future)

    try:
        window = service_list_external_events_window(
            user_id=user_id,
            from_iso=d_from.isoformat(),
            to_iso=d_to.isoformat(),
            user_jwt=user_jwt,
            service=service,
        )

        raw = window.get("occurrences") or []
        occurrences: List[Dict[str, Any]] = []
        for ev in raw:
            occurrences.append(
                {
                    "occurrence_date": ev.get("occurrence_date"),
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