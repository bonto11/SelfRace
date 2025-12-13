# Services/coach_plan_active.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

# Services/coach_plan_active.py – relevantná časť

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
    db_clear_daily_for_user_plan,
)
from Routes_DB.coach_plan_weekly import db_clear_weekly_for_user_plan

def _ensure_latest_plan_meta(user_id: int) -> Dict[str, Any]:
    """
    Nájde najnovší záznam v coach_plan_meta pre daného usera.
    Ak nič nie je, hodí ValueError.
    """
    meta = db_get_latest_plan_meta_for_user(user_id)
    if not meta:
        raise ValueError("No generated plan meta found for this user.")
    return meta


def service_save_active_plan(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aktivuje najnovší vygenerovaný plán.

    - očakáva, že weekly generátor už založil coach_plan_meta so status='generated'
    - zaarchivuje všetky existujúce plány (generated/active)
    - najnovšiemu nastaví status='active'
    - vráti info pre FE
    """
    # 1) nájdi najnovší plán z meta
    meta = _ensure_latest_plan_meta(user_id)
    plan_id: str = meta["plan_id"]

    # 2) archivuj staré plány (generated + active)
    db_archive_user_plans(user_id)

    # 3) nastav status = active pre daný plan_id
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
# Services/coach_plan_active.py (príklad)

def service_cancel_active_plan(user_id: int) -> dict:
    """
    Ukončí aktuálny aktívny plán:
      - nájde active meta
      - nastaví status='archived'
      - vymaže všetky weekly + daily riadky daného plan_id
    """
    meta = db_get_active_plan_meta_for_user(user_id)
    if not meta:
        raise ValueError("User has no active plan to cancel.")

    plan_id = meta["plan_id"]

    # 1) meta -> archived
    updated_meta = db_update_plan_status(user_id, plan_id, "archived") or meta

    # 2) zmaž plán
    weekly_deleted = db_clear_weekly_for_user_plan(user_id=user_id, plan_id=plan_id)
    daily_deleted = db_clear_daily_for_user_plan(user_id=user_id, plan_id=plan_id)

    return {
        "plan_id": plan_id,
        "meta": updated_meta,
        "weekly_deleted": weekly_deleted,
        "daily_deleted": daily_deleted,
    }


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
    
def service_get_active_plan_status(user_id: int) -> Dict[str, Any]:
    """
    Zistí, či má user aktívny plán.

    Vráti:
      {
        "has_active": bool,
        "plan_id": Optional[str],
        "meta": Optional[dict]
      }
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id)
    if not meta:
        return {
            "has_active": False,
            "plan_id": None,
            "meta": None,
        }

    return {
        "has_active": True,
        "plan_id": meta.get("plan_id"),
        "meta": meta,
    }