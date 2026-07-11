# Services/AI/session_preview/builder.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from DB.coach_plan_daily import db_get_daily_session_by_id_full  # nová DB funkcia, pozri nižšie


def build_context_for_session_preview(
    *,
    user_id: int,
    session_id: int,
    comment: str,
    request_change: bool,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Zostaví context payload pre AI: tá jedna session (plné dáta), athlete_state
    (kapacity, únava), a preview_thread (história tejto konverzácie).
    """
    session = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not session:
        return None

    # TODO: napoj na existujúce zdroje athlete_state / zones / latest_paces,
    # rovnako ako to robí daily_plan/builder.py — tu len kostra.
    return {
        "session": {
            "plan_date": session.get("plan_date"),
            "sport": session.get("sport"),
            "title": session.get("title"),
            "duration_min": session.get("duration_min"),
            "notes": session.get("notes"),
            "structure": session.get("structure"),
        },
        "preview_thread": session.get("preview_thread") or [],
        "user_input": {
            "comment": comment,
            "request_change": request_change,
        },
    }
