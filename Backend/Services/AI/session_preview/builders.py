# Services/AI/session_preview/builders.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from DB.coach_plan_daily import db_get_daily_session_by_id_full
from DB.athlete_state import db_get_latest_athlete_state
from DB.zones import db_get_user_zones
from DB.thresholds import db_get_latest_thresholds
from DB.latest_paces import db_get_latest_paces


def build_context_for_session_preview(
    *,
    user_id: int,
    session_id: int,
    comment: str,
    request_change: bool,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Zostaví context payload pre AI: tá jedna naplánovaná session (plné dáta),
    athlete_state (kapacity, únava), zóny/prahy/tempá pre kontext rady,
    a preview_thread (história tejto konverzácie k danej session).
    """
    session = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not session:
        return None

    athlete_state = db_get_latest_athlete_state(user_id, ctx=ctx) or {}
    zones = db_get_user_zones(user_id, ctx=ctx) or {}
    thresholds = db_get_latest_thresholds(user_id, ctx=ctx) or {}
    latest_paces = db_get_latest_paces(user_id, ctx=ctx) or {}

    return {
        "session": {
            "plan_date": session.get("plan_date"),
            "sport": session.get("sport"),
            "kind": session.get("kind"),
            "title": session.get("title"),
            "duration_min": session.get("duration_min"),
            "notes": session.get("notes"),
            "structure": session.get("structure"),
        },
        "athlete_state": athlete_state,
        "zones": zones,
        "thresholds": thresholds,
        "latest_paces": latest_paces,
        "preview_thread": session.get("preview_thread") or [],
        "user_input": {
            "comment": comment,
            "request_change": request_change,
        },
    }
