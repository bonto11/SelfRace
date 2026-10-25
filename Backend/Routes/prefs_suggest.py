# Routes/prefs_suggest.py
"""AI návrh nastavenia coach prefs z textu cieľa – za prepínačom prefs_suggest."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from Modules.Supabase.auth import get_auth_ctx, require_user
from Modules.Supabase.ownership import caller_user_id
from Services.AI.prefs_suggest.main import service_prefs_suggest
from Services.features import service_feature_enabled

router = APIRouter(prefix="/prefs-suggest", tags=["prefs-suggest"])


class SuggestIn(BaseModel):
    request: Optional[str] = Field(None, max_length=1500)
    # predošlé kolá z FE: {role: user, text} / {role: assistant, reply_text}
    thread: List[Dict[str, Any]] = Field(default_factory=list, max_length=8)


@router.post("/{user_id}")
def post_prefs_suggest(req: Request, user_id: int, payload: SuggestIn) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    caller = caller_user_id(ctx)
    if not service_feature_enabled(caller, "prefs_suggest"):
        return {"success": False, "error_code": "feature_disabled"}
    # PREČO len vlastník: minul by kvótu cudzieho usera; tréner prefs zverenca nemení
    if caller != int(user_id):
        return {"success": False, "error_code": "forbidden"}

    res = service_prefs_suggest(
        user_id=int(user_id), request=payload.request, thread=payload.thread, ctx=ctx
    )
    if not res.get("ok"):
        return {"success": False, "error_code": res.get("code") or "ai_generation_failed"}
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}
