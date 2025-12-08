# Services/coach_plan_active.py
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from Routes_DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
    db_archive_user_plans,
    db_get_latest_plan_meta_for_user,
    db_get_active_plan_meta_for_user,
    db_update_plan_status,
)
from Routes_DB.coach_plan_weekly import db_get_latest_plan_id_for_user
from Routes_DB.coach_plan_daily import db_list_daily_for_user_horizon


def _resolve_plan_id_from_payload(
    user_id: int,
    payload: Dict[str, Any],
) -> str:
    """
    Snaží sa získať plan_id v tomto poradí:
      1) payload.meta.plan_id
      2) najnovší coach_plan_meta pre usera
      3) najnovší plan_id z coach_plan_weekly

    Keď nič → ValueError.
    """
    meta = payload.get("meta") or {}

    plan_id = meta.get("plan_id")
    if plan_id:
        return str(plan_id)

    meta_row = db_get_latest_plan_meta_for_user(user_id=user_id)
    if meta_row and meta_row.get("plan_id"):
        return str(meta_row["plan_id"])

    # fallback – podľa weekly tabulky
    latest_weekly_plan_id = db_get_latest_plan_id_for_user(user_id=user_id)
    if latest_weekly_plan_id:
        return str(latest_weekly_plan_id)

    raise ValueError(
        "No plan_id found to activate. "
        "Generate a weekly plan first."
    )


def _ensure_meta_row_active(
    user_id: int,
    plan_id: str,
    payload_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Zaistí, že v coach_plan_meta existuje riadok pre plan_id
    a má status='active'.

    - ak existuje → len prepne status
    - ak neexistuje → insert 'generated' + update na 'active'
    """
    payload_meta = payload_meta or {}

    # pokus: update status priamo (ak riadok existuje)
    meta_row = db_update_plan_status(user_id=user_id, plan_id=plan_id, new_status="active")
    if meta_row:
        return meta_row

    # ak neexistuje, založ ho ako generated a hneď prehoď na active
    inserted = db_insert_plan_meta_generated(
        user_id=user_id,
        plan_id=plan_id,
        state_id=payload_meta.get("state_id"),
        weeks_total=payload_meta.get("weeks_total"),
        start_date=payload_meta.get("start_date"),
        end_date=payload_meta.get("end_date"),
        main_sport=payload_meta.get("main_sport"),
        goal_kind=payload_meta.get("goal_kind"),
        source=payload_meta.get("source") or "ai_weekly_v1",
    )

    # potom prepni na active
    meta_row2 = db_update_plan_status(user_id=user_id, plan_id=plan_id, new_status="active")
    return meta_row2 or inserted or {"plan_id": plan_id, "status": "active"}


def _compute_current_horizon_for_user(user_id: int) -> Tuple[str, str, int]:
    """
    Hrubý výpočet aktuálneho horizontu z coach_plan_daily.

    - použije db_list_daily_for_user_horizon(user_id, 365)
    - zoberie min/max plan_date
    - vráti (start_str, end_str, horizon_days)
    """
    rows = db_list_daily_for_user_horizon(user_id=user_id, horizon_days=365) or []
    if not rows:
        return "", "", 0

    dates: List[date] = []
    for r in rows:
        d = r.get("plan_date")
        if not d:
            continue
        if isinstance(d, date):
            dates.append(d)
        else:
            # predpoklad "YYYY-MM-DD"
            try:
                dates.append(date.fromisoformat(str(d)[:10]))
            except Exception:
                continue

    if not dates:
        return "", "", 0

    dates_sorted = sorted(dates)
    start = dates_sorted[0]
    end = dates_sorted[-1]
    today = date.today()

    horizon_days = max((end - today).days + 1, 0)

    return (start.isoformat(), end.isoformat(), horizon_days)


# -----------------------------------
# PUBLIC SERVICES PRE ACTIVE PLAN
# -----------------------------------


def service_save_active_plan(
    user_id: int,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Aktivuje plán:

    - nájde / vyberie plan_id (payload.meta / meta / weekly)
    - archivuje staré plány (generated+active)
    - nastaví coach_plan_meta na status='active'
    - vráti plan_id + meta
    """
    # 1) plan_id
    plan_id = _resolve_plan_id_from_payload(user_id=user_id, payload=payload)
    meta_in = payload.get("meta") or {}

    # 2) archivuj staré plány
    db_archive_user_plans(user_id=user_id, statuses=None)

    # 3) zaisti meta row so status='active'
    meta_row = _ensure_meta_row_active(
        user_id=user_id,
        plan_id=plan_id,
        payload_meta=meta_in,
    )

    # 4) horizont – len info (nič negenerujeme)
    plan_start, plan_end, horizon_days = _compute_current_horizon_for_user(user_id)

    return {
        "plan_id": plan_id,
        "meta": meta_row,
        "plan_start": plan_start,
        "plan_end": plan_end,
        "horizon_days": horizon_days,
    }


def service_cancel_active_plan(
    user_id: int,
    plan_id: Optional[str],
) -> int:
    """
    Zruší aktívny plán:

    - ak je plan_id, použije ten
    - inak nájde active meta pre usera
    - prepne status na 'cancelled'
    """
    eff_plan_id = plan_id
    if not eff_plan_id:
        meta = db_get_active_plan_meta_for_user(user_id=user_id)
        if not meta:
            return 0
        eff_plan_id = str(meta.get("plan_id"))

    if not eff_plan_id:
        return 0

    updated = db_update_plan_status(
        user_id=user_id,
        plan_id=eff_plan_id,
        new_status="cancelled",
    )
    return 1 if updated else 0


def service_continue_active_plan(
    user_id: int,
    min_horizon_days: int,
) -> Dict[str, Any]:
    """
    Zatiaľ len informačný stub:

    - nájde active plán
    - spočíta aktuálny horizon z daily
    - nevolá AI (žiadne nové dni negenerujeme)
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id)
    if not meta:
        raise ValueError("User has no active plan to continue.")

    plan_id = str(meta.get("plan_id"))
    plan_start, plan_end, current_horizon = _compute_current_horizon_for_user(user_id)

    # TODO: neskôr doplniť generovanie, ak current_horizon < min_horizon_days
    extended_days = 0

    return {
        "plan_id": plan_id,
        "extended_days": extended_days,
        "plan_start": plan_start,
        "plan_end": plan_end,
        "horizon_days": max(current_horizon, min_horizon_days),
        "note": "continue_active_plan is not fully implemented yet (no auto-extension).",
    }


def service_extend_active_plan(
    user_id: int,
    min_horizon_days: int,
) -> Dict[str, Any]:
    """
    Rovnako ako continue – zatiaľ len stub bez AI generovania.
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id)
    if not meta:
        raise ValueError("User has no active plan to extend.")

    plan_id = str(meta.get("plan_id"))
    plan_start, plan_end, current_horizon = _compute_current_horizon_for_user(user_id)

    # TODO: sem príde reálne generovanie ďalších dní
    extended_days = 0

    return {
        "plan_id": plan_id,
        "extended_days": extended_days,
        "plan_start": plan_start,
        "plan_end": plan_end,
        "horizon_days": max(current_horizon, min_horizon_days),
        "note": "extend_active_plan is not fully implemented yet (no auto-extension).",
    }


def service_reorder_daily_sessions(
    user_id: int,
    updates: List[Dict[str, Any]],
) -> bool:
    """
    Stub – reorder ešte neriešime.
    FE dostane success=False → vieš tam dať TODO toast.
    """
    # TODO: implementovať cez update coach_plan_daily (plan_date + session_index)
    # Napr. Routes_DB.coach_plan_daily.db_update_reorder(...)
    return False


def service_link_activity(
    user_id: int,
    session_id: int,
    activity_id: Optional[int],
) -> bool:
    """
    Stub – mapping planned session ↔ activity.

    TODO:
      - vytvoriť v Routes_DB.coach_plan_daily funkciu, ktorá
        urobí update activity_id podľa id riadku.
    """
    # zatiaľ vraciame False, nech vidíš, že to nie je hotové
    return False