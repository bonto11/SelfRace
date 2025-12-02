# Services/coach_plan_common.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date, timedelta

from Routes_DB.coach_plan_daily import (
    db_insert_planned_sessions,
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
    """Normalizácia športu na run/ride/strength/swim/other."""
    s = str(sport or "").lower()
    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"
    if s not in ("run", "ride", "strength", "swim", "other"):
        return "other"
    return s


def service_hr_zone_text(sess: Dict[str, Any]) -> Optional[str]:
    """
    Z JSON session vyrobí ľudské zone_text, napr. "HR 140–152".
    Očakáva sess["target_hr_bpm_range"] = [low, high].
    """
    hr = sess.get("target_hr_bpm_range")
    if isinstance(hr, list) and len(hr) == 2:
        try:
            low, high = int(hr[0]), int(hr[1])
            return f"HR {low}–{high}"
        except Exception:
            return None
    return None


# ───────────────────────────── public service API pre DAILY DB ─────────────────────────────


def service_get_planned_range_rows(
    user_id: int,
    start_iso: str,
    end_iso: str,
):
    """
    Pre FE endpoint /coach-plan/range – vracia všetky riadky z coach_plan_daily.
    """
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
    """
    Pôvodný GET /coach-plan/{user_id}?date_from=...&date_to=...&plan_id=...

    Stále užitočné pre:
      - debug
      - starší FE / admin view
      - služby, ktoré potrebujú prečítať raw plán
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
):
    """
    Helper pre iné služby (napr. auto-mapovanie plán ↔️ aktivity).
    """
    return db_fetch_plan_rows_in_range(
        user_id=user_id,
        start_iso=start_d.isoformat(),
        end_iso=end_d.isoformat(),
        columns=columns,
    )


# ───────────────────────────── CANCEL, LINK, REORDER ─────────────────────────────


def service_cancel_plan_for_user(user_id: int, plan_id: Optional[str]):
    """
    Zruší plán v coach_plan_daily:
      - ak plan_id → zmaže len daný plán pre usera
      - inak všetky AI planned sessions od dneška (vrátane)
    """
    from_iso = None if plan_id else date.today().isoformat()
    deleted = db_delete_plan_for_user(
        user_id=user_id,
        plan_id=plan_id,
        from_iso=from_iso,
    )
    print(
        f"[SERVICE-COACH-PLAN-COMMON] cancel_plan_for_user user={user_id} "
        f"plan_id={plan_id} from={from_iso} deleted={deleted}"
    )
    return deleted


def service_link_session_to_activity(session_id: int, activity_id: Optional[int]):
    """
    Manuálne / programové mapovanie planned session ↔️ aktivita.
    activity_id=None → odmapovanie.
    """
    updated = db_link_session_to_activity(
        session_id=session_id,
        activity_id=activity_id,
    )
    print(
        f"[SERVICE-COACH-PLAN-COMMON] link_session_to_activity "
        f"session_id={session_id} activity_id={activity_id} updated={updated}"
    )
    return updated


def service_reorder_planned_sessions(
    user_id: int,
    updates: List[Dict[str, Any]],
):
    """
    Batch presun tréningov (plan_date + session_index).
    Používa sa pri drag&drop boarde.
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
            raise ValueError(
                f"Invalid session_index in updates: {u.get('session_index')!r}"
            )

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
        f"[SERVICE-COACH-PLAN-COMMON] reorder_planned_sessions user={user_id} "
        f"updates={len(norm)} updated={updated}"
    )
    return updated