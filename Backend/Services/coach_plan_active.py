# Services/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Routes_DB.coach_plan_meta import (
    db_insert_plan_meta_generated,
    db_archive_user_plans,
    db_get_latest_plan_meta_for_user,
    db_get_active_plan_meta_for_user,
    db_update_plan_status,
)
from Routes_DB.coach_plan_daily import (
    # ak máš iné názvy, len si uprav importy
    db_link_session_to_activity,
)


def _ensure_latest_plan_meta(user_id: int) -> Dict[str, Any]:
    """
    Nájde najnovší záznam v coach_plan_meta pre daného usera.
    Ak nič nie je, hodí ValueError.
    """
    meta = db_get_latest_plan_meta_for_user(user_id)
    if not meta:
        raise ValueError("No generated plan meta found for this user.")
    return meta


# ---------------------------------------------------------------------
# SAVE = označ najnovší plan ako ACTIVE
# ---------------------------------------------------------------------
def service_save_active_plan(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aktivuje najnovší vygenerovaný plán.

    - zaarchivuje všetky existujúce plány (generated/active)
    - najnovšiemu nastaví status='active'
    - vráti info pre FE
    """
    # 1) nájdi najnovší plán
    meta = _ensure_latest_plan_meta(user_id)
    plan_id: str = meta["plan_id"]

    # 2) archivuj staré plány
    db_archive_user_plans(user_id)

    # 3) nastav status = active
    updated = db_update_plan_status(user_id, plan_id, "active") or meta

    return {
        "plan_id": plan_id,
        "plan_start": updated.get("start_date"),
        "plan_end": updated.get("end_date"),
        "weeks": updated.get("weeks_total"),
        "meta": updated,
    }


# ---------------------------------------------------------------------
# CANCEL = zruš aktívny plán
# ---------------------------------------------------------------------
def service_cancel_active_plan(user_id: int, plan_id: Optional[str]) -> int:
    """
    Zruší aktívny plán.

    - ak je plan_id None -> nájde aktuálny aktívny plán v meta
    - nastaví status='cancelled'
    - vráti 1 ak sa niečo zmenilo, inak 0
    """
    meta = db_get_active_plan_meta_for_user(user_id)
    if not meta:
        return 0

    target_plan_id: str = plan_id or meta["plan_id"]
    updated = db_update_plan_status(user_id, target_plan_id, "cancelled")
    return 1 if updated else 0


# ---------------------------------------------------------------------
# CONTINUE = jednoduchý stub (len vráti meta info)
# ---------------------------------------------------------------------
def service_continue_active_plan(
    user_id: int,
    min_horizon_days: int,
) -> Dict[str, Any]:
    """
    Zatiaľ len stub – vráti info o aktuálnom aktívnom pláne.
    Neskôr sem vieš doplniť reálnu logiku predĺženia.
    """
    meta = db_get_active_plan_meta_for_user(user_id)
    if not meta:
        return {
            "success": False,
            "extended_days": 0,
            "plan_start": "",
            "plan_end": "",
            "horizon_days": 0,
            "note": "no_active_plan",
        }

    return {
        "success": True,
        "extended_days": 0,
        "plan_start": meta.get("start_date") or "",
        "plan_end": meta.get("end_date") or "",
        "horizon_days": min_horizon_days,
        "note": "continue_active_plan stub – no automatic extension yet",
    }


# ---------------------------------------------------------------------
# EXTEND = ďalší stub
# ---------------------------------------------------------------------
def service_extend_active_plan(
    user_id: int,
    min_horizon_days: int,
) -> Dict[str, Any]:
    """
    Stub pre extend – v tejto verzii nič nemení, len vráti info,
    aby FE nepadal.
    """
    meta = db_get_active_plan_meta_for_user(user_id)
    if not meta:
        return {
            "success": False,
            "extended_days": 0,
            "plan_start": "",
            "plan_end": "",
            "horizon_days": 0,
            "note": "no_active_plan",
        }

    return {
        "success": True,
        "extended_days": 0,
        "plan_start": meta.get("start_date") or "",
        "plan_end": meta.get("end_date") or "",
        "horizon_days": min_horizon_days,
        "note": "extend_active_plan stub – not implemented yet",
    }

# ---------------------------------------------------------------------
# LINK ACTIVITY
# ---------------------------------------------------------------------
def service_link_activity(
    user_id: int,
    session_id: int,
    activity_id: Optional[int],
) -> bool:
    """
    Prelinkovanie planned session -> activity_id.
    """
    try:
        db_link_session_to_activity(user_id, session_id, activity_id)
        return True
    except Exception:
        return False