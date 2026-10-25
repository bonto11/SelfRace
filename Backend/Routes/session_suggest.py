# Routes/session_suggest.py
"""AI návrh jedného tréningu (advisor, formulár „Pridať tréning“) – za prepínačom session_suggest."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from Modules.Supabase.auth import get_auth_ctx, require_user
from Modules.Supabase.ownership import caller_user_id
from Services.AI.session_suggest.main import service_session_suggest
from Services.features import service_feature_enabled

router = APIRouter(prefix="/session-suggest", tags=["session-suggest"])


class SuggestIn(BaseModel):
    plan_date: str = Field(..., min_length=10, max_length=10, description="YYYY-MM-DD")
    request: Optional[str] = Field(None, max_length=500)
    # predošlé kolá z FE: {role: user, text} / {role: assistant, reply_text, session}
    thread: List[Dict[str, Any]] = Field(default_factory=list, max_length=8)


@router.post("/{user_id}")
def post_session_suggest(req: Request, user_id: int, payload: SuggestIn) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    caller = caller_user_id(ctx)
    if not service_feature_enabled(caller, "session_suggest"):
        return {"success": False, "error_code": "feature_disabled"}
    # PREČO len vlastník: AI by minulo kvótu cudzieho usera (aj tréner
    # počas prezerania zverenca AI spúšťať nemôže)
    if caller != int(user_id):
        return {"success": False, "error_code": "forbidden"}

    res = service_session_suggest(
        user_id=int(user_id),
        plan_date=payload.plan_date,
        request=payload.request,
        thread=payload.thread,
        ctx=ctx,
    )
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "ai_generation_failed"}
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}
