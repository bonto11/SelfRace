from __future__ import annotations
from typing import Any, Dict, List, Optional
from DB.user_pace_history import db_get_latest_paces, db_get_pace_trend, db_insert_pace_row
from Modules.Supabase.auth import AuthCtx

def service_get_latest_paces(user_id: int, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    return db_get_latest_paces(user_id, ctx=ctx)

def service_get_pace_history_trends(user_id: int, days: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_pace_trend(user_id, days, ctx=ctx)

def service_save_pace_history(user_id: int, payload: Dict[str, Any], ctx: AuthCtx) -> Dict[str, Any]:
    payload["user_id"] = user_id
    return db_insert_pace_row(payload, ctx=ctx)