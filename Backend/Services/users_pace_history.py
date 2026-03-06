# Services/users_pace_history.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from Routes_DB.users_pace_history import (
    db_save_pace_history,
    db_get_latest_paces,
    db_get_pace_history_trends,
)
from Modules.Supabase.auth import AuthCtx

def service_save_pace_history(
    user_id: int,
    payload: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží riadok s históriou temp a odhadov z AI analytiky.
    """
    row = {
        "user_id": user_id,
        **payload # DB vrstva očakáva klúče ako z1_pace_s, est_5k_time_min atď.
    }
    return db_save_pace_history(row, ctx=ctx)


def service_get_latest_paces(
    user_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Vráti posledné vyhodnotené tempá/odhady používateľa.
    """
    return db_get_latest_paces(user_id=user_id, ctx=ctx)


def service_get_pace_history_trends(
    user_id: int,
    ctx: AuthCtx,
    days: int = 90
) -> List[Dict[str, Any]]:
    """
    Vráti pole historických odhadov temp pre generovanie grafu na FE.
    Zoradené od najstaršieho po najnovšie (ideálne pre timeseries grafy).
    """
    return db_get_pace_history_trends(user_id=user_id, days=days, ctx=ctx)

