# Services/AI/session_preview/main.py
from __future__ import annotations

from typing import Any, Dict

from Modules.Supabase.auth import AuthCtx
from Services.AI.session_preview.builder import build_context_for_session_preview
from Services.AI.session_preview.generate import generate_session_preview_json
from DB.coach_plan_daily import (
    db_get_daily_session_by_id_full,
    db_append_preview_thread_entry,
    db_apply_session_preview_update,
)


def service_session_preview_ask(
    *,
    user_id: int,
    session_id: int,
    comment: str,
    request_change: bool,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    context_payload = build_context_for_session_preview(
        user_id=user_id, session_id=session_id, comment=comment,
        request_change=request_change, ctx=ctx,
    )
    if context_payload is None:
        return {"ok": False, "code": "session_not_found"}

    result = generate_session_preview_json(context_payload)

    # Ulož user + assistant entries do preview_thread
    db_append_preview_thread_entry(user_id, session_id, {
        "role": "user", "comment": comment, "request_change": request_change,
    }, ctx=ctx)
    db_append_preview_thread_entry(user_id, session_id, {
        "role": "assistant",
        "reply_text": result.get("reply_text"),
        "changed": bool(result.get("changed")),
    }, ctx=ctx)

    # Ak AI zmenilo session, aplikuj update na coach_plan_daily riadok
    if result.get("changed"):
        db_apply_session_preview_update(
            user_id, session_id,
            duration_min=result.get("updated_duration_min"),
            notes=result.get("updated_notes"),
            structure=result.get("updated_structure"),
            ctx=ctx,
        )

    return {"ok": True, "data": result}
