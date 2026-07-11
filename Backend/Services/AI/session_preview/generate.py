# Services/AI/session_preview/generate.py
from __future__ import annotations

import json
from typing import Any, Dict, Optional

from Services.AI.session_preview.prompts import build_prompts_for_session_preview
from Services.AI.llm_client import call_llm_json  # tvoj existujúci LLM wrapper


def generate_session_preview_json(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    system_txt, user_txt = build_prompts_for_session_preview(context_payload, settings=settings)
    raw = call_llm_json(system_txt, user_txt, model=model)
    return raw
