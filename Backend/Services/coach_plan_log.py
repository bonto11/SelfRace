from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import date

from Routes_DB.coach_plan_log import (
    db_insert_planned_session,
    db_insert_planned_sessions,
    db_update_planned_session,
    db_delete_planned_session,
    db_fetch_plan_rows_in_range,
    db_get_planned_range_rows,
    db_get_planned_sessions_filtered,
    db_clear_range_for_user,
    db_delete_plan_for_user,
    db_link_session_to_activity,
    db_reorder_planned_sessions,
)

# ───────────────────────────── helpers ─────────────────────────────


def service_parse_iso_date(s: str) -> date:
    """Parsuje YYYY-MM-DD → datetime.date."""
    try:
        y, m, d = map(int, s.split("-"))
        return date(y, m, d)
    except Exception:
        raise ValueError(f"Invalid date: {s}")


def service_canonical_sport(sport: Any) -> str:
    s = str(sport or "").lower()
    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"
    if s not in ("run", "ride", "strength", "swim", "other"):
        return "other"
    return s


def service_hr_zone_text(sess: Dict[str, Any]) -> Optional[str]:
    hr = sess.get("target_hr_bpm_range")
    if isinstance(hr, list) and len(hr) == 2:
        try:
            low, high = int(hr[0]), int(hr[1])
            return f"HR {low}–{high}"
        except Exception:
            return None
    return None


# ───────────────────────────── public service API ─────────────────────────────


def service_get_planned_range_rows(
    user_id: int,
    start_iso: str,
    end_iso: str,
):
    """Pre FE endpoint /coach-plan/range – vracia všetky riadky."""
    return db_get_planned_range_rows(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
    )


def service_get_planned_sessions_filtered(
    user_id: int,
    date_from: Optional[str],
    date_to: Optional[str],
    plan_id: Optional[str],
):
    """Pôvodný GET /coach-plan/{user_id} – filtre."""
    return db_get_planned_sessions_filtered(
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        plan_id=plan_id,
    )


def service_fetch_plan_rows_in_range(
    user_id: int,
    start_d: date,
    end_d: date,
    columns: Optional[str] = None,
):
    """Helper pre iné služby (napr. auto-mapovanie)."""
    return db_fetch_plan_rows_in_range(
        user_id=user_id,
        start_iso=start_d.isoformat(),
        end_iso=end_d.isoformat(),
        columns=columns,
    )


# ───────────────────────────── AI UPSERT (tvorba plánu) ─────────────────────────────


def service_upsert_ai_plan_for_user(
    user_id: int,
    next_10_days: List[Dict[str, Any]],
    overwrite: bool = True,
):
    """
    Vytvorí ÚPLNE NOVÝ plán (nové plan_id).
    Toto používame iba pri /coach/generate.
    """
    if not isinstance(next_10_days, list) or not next_10_days:
        raise ValueError("next_10_days is required and must be non-empty")

    from uuid import uuid4

    all_dates: List[date] = []
    for d in next_10_days:
        if not isinstance(d, dict) or "day" not in d:
            raise ValueError("Invalid entry in next_10_days (missing 'day')")
        all_dates.append(service_parse_iso_date(str(d["day"])))

    start_d = min(all_dates)
    end_d = max(all_dates)

    plan_id = str(uuid4())

    if overwrite:
        db_clear_range_for_user(
            user_id=user_id,
            start_iso=start_d.isoformat(),
            end_iso=end_d.isoformat(),
        )

    rows: List[Dict[str, Any]] = []

    for d in next_10_days:
        day_str = str(d["day"])
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            raise ValueError(f"Invalid 'sessions' for day {day_str}")

        for idx, sess in enumerate(sessions):
            if not isinstance(sess, dict):
                continue

            sport = service_canonical_sport(sess.get("sport"))
            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_str,
                "sport": sport,
                "title": sess.get("title"),
                "duration_min": sess.get("duration_min"),
                "intensity": sess.get("intensity"),
                "zone_text": service_hr_zone_text(sess),
                "structure": sess.get("structure"),
                "notes": sess.get("notes"),
                "source": "ai",
                "plan_id": plan_id,
                "session_type": sess.get("session_type"),
                "session_index": idx,
                "payload": sess,
                "activity_id": None,
            }
            rows.append(row)

    if not rows:
        raise ValueError("No sessions to save")

    inserted = db_insert_planned_sessions(rows)

    print(
        f"[SERVICE-COACH-PLAN] upsert_ai_plan_for_user user={user_id} "
        f"plan_id={plan_id} inserted={inserted} "
        f"range={start_d}..{end_d}"
    )

    return {
        "plan_id": plan_id,
        "inserted": inserted,
        "start": start_d,
        "end": end_d,
    }


# ───────────────────────────── CANCEL, LINK, REORDER ─────────────────────────────


def service_cancel_plan_for_user(user_id: int, plan_id: Optional[str]):
    """
    Zruší aktívny plán:
      - ak plan_id → zmaže len daný plán
      - inak všetky AI planned sessions od dneška (vrátane)
    """
    from_iso = None if plan_id else date.today().isoformat()
    deleted = db_delete_plan_for_user(
        user_id=user_id,
        plan_id=plan_id,
        from_iso=from_iso,
    )
    print(
        f"[SERVICE-COACH-PLAN] cancel_plan_for_user user={user_id} "
        f"plan_id={plan_id} from={from_iso} deleted={deleted}"
    )
    return deleted


def service_link_session_to_activity(session_id: int, activity_id: Optional[int]):
    """
    Manuálne / programové mapovanie planned session ↔ aktivita.
    activity_id=None → odmapovanie.
    """
    updated = db_link_session_to_activity(
        session_id=session_id,
        activity_id=activity_id,
    )
    print(
        f"[SERVICE-COACH-PLAN] link_session_to_activity session_id={session_id} "
        f"activity_id={activity_id} updated={updated}"
    )
    return updated


def service_reorder_planned_sessions(
    user_id: int,
    updates: List[Dict[str, Any]],
):
    """
    Batch presun tréningov (plan_date + session_index).
    """
    if not updates:
        return 0

    norm: List[Dict[str, Any]] = []
    for u in updates:
        if not isinstance(u, dict):
            continue
        sid = u.get("id")
        plan_date_raw = u.get("plan_date")
        if sid is None or plan_date_raw is None:
            continue

        date_iso = str(plan_date_raw)
        # ak failne → ValueError (400 v routeri)
        _ = service_parse_iso_date(date_iso)

        try:
            sid_int = int(sid)
        except Exception:
            raise ValueError(f"Invalid id in updates: {sid!r}")

        try:
            idx_int = int(u.get("session_index", 0))
        except Exception:
            raise ValueError(f"Invalid session_index in updates: {u.get('session_index')!r}")

        norm.append(
            {
                "id": sid_int,
                "plan_date": date_iso,
                "session_index": idx_int,
            }
        )

    if not norm:
        return 0

    updated = db_reorder_planned_sessions(user_id=user_id, updates=norm)
    print(
        f"[SERVICE-COACH-PLAN] reorder_planned_sessions user={user_id} "
        f"updates={len(norm)} updated={updated}"
    )
    return updated


# ───────────────────────────── ACTIVE PLAN HORIZON ─────────────────────────────

PlanHorizon = Tuple[str, str, int]  # (start_iso, end_iso, horizon_days)


def _detect_active_plan_horizon(user_id: int) -> PlanHorizon:
    """
    Nájde aktívny plán (najnovší plan_id podľa max(plan_date)) a vráti:
      - start_iso: prvý deň plánu
      - end_iso: posledný deň plánu
      - horizon_days: (end_iso - today) v dňoch
    """
    rows = db_get_planned_sessions_filtered(
        user_id=user_id,
        date_from=None,
        date_to=None,
        plan_id=None,
    )
    if not rows:
        raise ValueError("User has no planned sessions")

    by_plan: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        pid = r.get("plan_id")
        if not pid:
            continue
        by_plan.setdefault(str(pid), []).append(r)

    if not by_plan:
        raise ValueError("No plan_id found for user")

    best_pid: Optional[str] = None
    best_last: Optional[str] = None

    for pid, lst in by_plan.items():
        dates = sorted(str(x["plan_date"])[:10] for x in lst if x.get("plan_date"))
        if not dates:
            continue
        last = dates[-1]
        if best_last is None or last > best_last:
            best_last = last
            best_pid = pid

    if not best_pid or not best_last:
        raise ValueError("Cannot determine active plan")

    active_rows = by_plan[best_pid]
    dates = sorted(str(x["plan_date"])[:10] for x in active_rows if x.get("plan_date"))
    if not dates:
        raise ValueError("Active plan has no dates")

    start_iso, end_iso = dates[0], dates[-1]

    end_d = service_parse_iso_date(end_iso)
    today_d = date.today()
    horizon = (end_d - today_d).days

    print(
        f"[SERVICE-COACH-PLAN] _detect_active_plan_horizon user={user_id} "
        f"plan_id={best_pid} start={start_iso} end={end_iso} "
        f"horizon={horizon}"
    )

    return (start_iso, end_iso, horizon)


# ───────────────────────────── EXTEND ACTIVE PLAN ─────────────────────────────


def service_extend_active_plan(
    user_id: int,
    min_horizon_days: int = 10,
) -> Dict[str, Any]:
    """
    Udrží aktívny plán tak, aby mal min. X dní dopredu.
    TERAZ: len spočíta horizont a NEEXENDUJE (skeleton bez AI).
    """

    start_iso, end_iso, horizon = _detect_active_plan_horizon(user_id)

    # zatiaľ len no-op, nech endpoint nespadne
    if horizon >= min_horizon_days:
        note = "already_sufficient"
    else:
        note = "extend_not_implemented_yet"

    result = {
        "extended_days": 0,
        "plan_start": start_iso,
        "plan_end": end_iso,
        "horizon_days": horizon,
        "note": note,
    }

    print(
        f"[SERVICE-COACH-PLAN] extend_active_plan user={user_id} "
        f"min_horizon={min_horizon_days} -> {result}"
    )

    return result