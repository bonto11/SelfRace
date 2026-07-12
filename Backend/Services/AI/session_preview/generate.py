# Services/AI/session_preview/generate.py
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional, Tuple

from Modules.Supabase.auth import AuthCtx
from Services.AI.session_preview.prompts import build_prompts_for_session_preview
from Services.AI.llm_router import call_llm, AI_MODEL_CATALOG  # rovnaký router ako activity_review


def _strip_code_fences(text: str) -> str:
    """Odstráni ```json ... ``` obal, ak ho model napriek inštrukcii pridal."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _parse_json_relaxed(text: str) -> Optional[Dict[str, Any]]:
    """Skúsi naparsovať JSON, s fallbackom na vytiahnutie prvého {...} bloku."""
    cleaned = _strip_code_fences(text)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    m = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


def generate_session_preview_reply(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
    model: Optional[str] = None,
    ctx: AuthCtx,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Zavolá LLM pre session preview a vráti (success, parsed_json, error_code).
    Rovnaký vzor ako activity_review/generate.py — len menší, jednosessionový scope.
    """
    system_txt, user_txt = build_prompts_for_session_preview(context_payload, settings=settings)

    model_to_use = model or AI_MODEL_CATALOG.get("session_preview_default")

    try:
        raw_text = call_llm(
            system_prompt=system_txt,
            user_prompt=user_txt,
            model=model_to_use,
            ctx=ctx,
        )
    except Exception as e:
        print("[AI-SESSION-PREVIEW] call_llm error:", repr(e))
        return False, None, "llm_call_failed"

    parsed = _parse_json_relaxed(raw_text or "")
    if parsed is None:
        print("[AI-SESSION-PREVIEW] JSON parse failed. Raw:", (raw_text or "")[:500])
        return False, None, "invalid_json_response"

    return True, parsed, None
