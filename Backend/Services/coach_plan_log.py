from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import date, timedelta

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


def service_get_planned_range_rows(user_id: int, start_iso: str, end_iso: str):
    return db_get_planned_range_rows(user_id=user_id, start_iso=start_iso, end_iso=end_iso)


def service_get_planned_sessions_filtered(user_id: int, date_from, date_to, plan_id):
    return db_get_planned_sessions_filtered(user_id, date_from, date_to, plan_id)


def service_fetch_plan_rows_in_range(
    user_id: int,
    start_d: date,
    end_d: date,
    columns: Optional[str] = None,
):
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
        all_dates.append(service_parse_iso_date(str(d["day"])))

    start_d = min(all_dates)
    end_d = max(all_dates)

    plan_id = str(uuid4())

    if overwrite:
        db_clear_range_for_user(user_id, start_d.isoformat(), end_d.isoformat())

    rows: List[Dict[str, Any]] = []

    for d in next_10_days:
        day_str = d["day"]
        sessions = d.get("sessions") or []
        for idx, sess in enumerate(sessions):
            sport = service_canonical_sport(sess.get("sport"))
            row = {
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

    inserted = db_insert_planned_sessions(rows)

    return {
        "plan_id": plan_id,
        "inserted": inserted,
        "start": start_d,
        "end": end_d,
    }


# ───────────────────────────── CANCEL, LINK, REORDER ─────────────────────────────


def service_cancel_plan_for_user(user_id: int, plan_id: Optional[str]):
    from_iso = None if plan_id else date.today().isoformat()
    return db_delete_plan_for_user(user_id=user_id, plan_id=plan_id, from_iso=from_iso)


def service_link_session_to_activity(session_id: int, activity_id: Optional[int]):
    return db_link_session_to_activity(session_id=session_id, activity_id=activity_id)


def service_reorder_planned_sessions(user_id: int, updates: List[Dict[str, Any]]):
    if not updates:
        return 0

    norm = []
    for u in updates:
        sid = int(u["id"])
        date_iso = str(u["plan_date"])
        _ = service_parse_iso_date(date_iso)
        idx = int(u.get("session_index", 0))
        norm.append({"id": sid, "plan_date": date_iso, "session_index": idx})

    return db_reorder_planned_sessions(user_id=user_id, updates=norm)


# ───────────────────────────── ACTIVE PLAN HORIZON ─────────────────────────────

PlanHorizon = Tuple[str, str, int]  # (start_iso, end_iso, horizon_days)


def _detect_active_plan_horizon(user_id: int) -> PlanHorizon:
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
        if pid:
            by_plan.setdefault(pid, []).append(r)

    if not by_plan:
        raise ValueError("No plan_id found")

    # vyber najnovší plán podľa max(plan_date)
    best_pid = None
    best_last = None
    for pid, lst in by_plan.items():
        dates = sorted(str(x["plan_date"])[:10] for x in lst)
        last = dates[-1]
        if best_last is None or last > best_last:
            best_last = last
            best_pid = pid

    if not best_pid:
        raise ValueError("Cannot determine active plan")

    # active rows
    act_rows = [r for r in by_plan[best_pid]]
    dates = sorted(str(x["plan_date"])[:10] for x in act_rows)
    start_iso, end_iso = dates[0], dates[-1]

    end_d = service_parse_iso_date(end_iso)
    horizon = (end_d - date.today()).days

    return (start_iso, end_iso, horizon)


# ───────────────────────────── EXTEND ACTIVE PLAN ─────────────────────────────


def service_extend_active_plan(
    user_id: int,
    min_horizon_days: int = 10,
) -> Dict[str, Any]:
    """
    Udrží aktívny plán tak, aby mal min. X dní dopredu.
    Toto je skeleton — AI doplníme spolu v ďalšom kroku.
    """

    start_iso, end_iso, horizon = _detect_active_plan_horizon(user_id)

    if horizon >= min_horizon_days:
        return {
            "extended_days": 0,
            "plan_start": start_iso,
            "plan_end": end_iso,
            "horizon_days": horizon,
            "note": "already_sufficient",
        }

    need_days = min_horizon_days - horizon
    if need_days <= 0:
        return {
            "extended_days": 0,
            "plan_start": start_iso,
            "plan_end": end_iso,
            "horizon_days": horizon,
            "note": "unexpected_no_extend",
        }

    # 1) stiahni aktívny plán
    active_rows = db_get_planned_range_rows(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
    )
    if not active_rows:
        raise ValueError("Active plan has no rows")

    plan_id = str(active_rows[0]["plan_id"])

    # 2) TU príde AI — skeleton
    raise NotImplementedError(
        "AI extend mode payload tu doplníme — teraz je služba pripravená."
    )

    # 3) Insert nových sessions (po doplnení AI)
    # inserted = db_insert_planned_sessions(new_rows)

    # return {
    #     "extended_days": inserted_days,
    #     "plan_start": start_iso,
    #     "plan_end": new_end_iso,
    #     "horizon_days": new_horizon,
    # }