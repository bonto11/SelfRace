# Services/coach_plan_log.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
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


# ───────────────────────────── helpers (logika) ─────────────────────────────


def service_parse_iso_date(s: str) -> date:
    """
    Parsuje YYYY-MM-DD na date.
    Pri chybe vyhodí ValueError – routa si to premapuje na HTTP 400.
    """
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
# (toto volajú Routes_FE a iné služby – vnútri len používaš db_* funckie)


def service_get_planned_range_rows(
    user_id: int,
    start_iso: str,
    end_iso: str,
) -> List[Dict[str, Any]]:
    """
    Pre FE endpoint /coach-plan/range – vracia všetky riadky.
    """
    return db_get_planned_range_rows(user_id=user_id, start_iso=start_iso, end_iso=end_iso)


def service_get_planned_sessions_filtered(
    user_id: int,
    date_from: Optional[str],
    date_to: Optional[str],
    plan_id: Optional[str],
) -> List[Dict[str, Any]]:
    """
    Pôvodný GET /coach-plan/{user_id} – filtre.
    """
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
) -> List[Dict[str, Any]]:
    """
    Helper pre iné služby (napr. auto-mapovanie).
    """
    start_iso = start_d.isoformat()
    end_iso = end_d.isoformat()
    return db_fetch_plan_rows_in_range(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
        columns=columns,
    )


def service_upsert_ai_plan_for_user(
    user_id: int,
    next_10_days: List[Dict[str, Any]],
    overwrite: bool = True,
) -> Dict[str, Any]:
    """
    Uloží AI plán do coach_planned_sessions.

    next_10_days: list items:
      { "day": "YYYY-MM-DD", "sessions": [ {..sess..}, ... ] }

    Tu je LEN logika (validácia, skladanie riadkov).
    Samotný insert/mazanie rieši DB vrstva.
    """
    if not isinstance(next_10_days, list) or not next_10_days:
        raise ValueError("next_10_days is required and must be a non-empty array")

    from uuid import uuid4

    # validácia + zber dátumov
    all_dates: List[date] = []
    for d in next_10_days:
        if not isinstance(d, dict) or "day" not in d:
            raise ValueError("Invalid entry in next_10_days (missing 'day')")
        all_dates.append(service_parse_iso_date(str(d["day"])))

    start_d = min(all_dates)
    end_d = max(all_dates)

    plan_id = str(uuid4())
    print(
        f"[SERVICE-COACH-PLAN] upsert_ai_plan_for_user user={user_id} "
        f"plan_id={plan_id} range={start_d}..{end_d} overwrite={overwrite}"
    )

    # ak treba, vyčisti existujúce v rozsahu (DB level)
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
            title = sess.get("title") or None
            duration = sess.get("duration_min")
            intensity = sess.get("intensity")
            session_type = sess.get("session_type") or None
            notes = sess.get("notes") or None
            zone_txt = service_hr_zone_text(sess)

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_str,
                "sport": sport,
                "title": title,
                "duration_min": duration,
                "intensity": intensity,
                "zone_text": zone_txt,
                "structure": sess.get("structure"),
                "notes": notes,
                "source": "ai",
                "plan_id": plan_id,
                "session_type": session_type,
                "session_index": idx,
                "payload": sess,
                "activity_id": None,
            }
            rows.append(row)

    if not rows:
        raise ValueError("No sessions to save")

    inserted = db_insert_planned_sessions(rows)
    print(
        f"[SERVICE-COACH-PLAN] insert done user={user_id} "
        f"plan_id={plan_id} inserted={inserted}"
    )

    return {
        "plan_id": plan_id,
        "inserted": inserted,
        "start": start_d,
        "end": end_d,
    }


def service_cancel_plan_for_user(
    user_id: int,
    plan_id: Optional[str],
) -> int:
    """
    Zruší aktívny plán:
      - ak plan_id → zmaže len daný plán
      - inak všetky AI planned sessions od dneška (vrátane)
    """
    from_iso: Optional[str]
    if plan_id:
        from_iso = None
    else:
        from_iso = date.today().isoformat()

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


def service_link_session_to_activity(
    session_id: int,
    activity_id: Optional[int],
) -> int:
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
) -> int:
    """
    Batch presun tréningov (plan_date + session_index).

    updates: list items:
      { "id": int, "plan_date": "YYYY-MM-DD", "session_index": int }

    - validuje dátumy cez parse_iso_date
    - normalizuje id a session_index na int
    - potom zavolá db_reorder_planned_sessions
    """
    if not isinstance(updates, list) or not updates:
        return 0

    norm_updates: List[Dict[str, Any]] = []

    for u in updates:
        if not isinstance(u, dict):
            continue

        sid = u.get("id")
        plan_date_raw = u.get("plan_date")
        session_index_raw = u.get("session_index", 0)

        if sid is None or plan_date_raw is None:
            continue

        # validácia dátumu (vyhodí ValueError → routa si to premapuje na 400)
        _ = service_parse_iso_date(str(plan_date_raw))

        try:
            sid_int = int(sid)
        except Exception:
            continue

        try:
            idx_int = int(session_index_raw)
        except Exception:
            idx_int = 0

        norm_updates.append(
            {
                "id": sid_int,
                "plan_date": str(plan_date_raw),
                "session_index": idx_int,
            }
        )

    if not norm_updates:
        return 0

    updated = db_reorder_planned_sessions(user_id=user_id, updates=norm_updates)
    print(
        f"[SERVICE-COACH-PLAN] reorder_planned_sessions user={user_id} "
        f"updates={len(norm_updates)} updated={updated}"
    )
    return updated