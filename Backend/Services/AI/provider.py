# Services/AI/provider.py
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from Services.AI.types import AiResult, AiError

def _provider() -> str:
    return (os.getenv("AI_PROVIDER") or "openai").strip().lower()

def _default_model(provider: str) -> Optional[str]:
    if provider == "openai":
        return os.getenv("OPENAI_MODEL_DEFAULT") or None
    if provider == "gemini":
        return os.getenv("GEMINI_MODEL_DEFAULT") or None
    return None


def ai_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    debug_raw: bool = False,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    p = _provider()
    m = model or _default_model(p)

    if p == "openai":
        from Services.AI.clients.openai_client import openai_call_json_model
        return openai_call_json_model(
            context_payload=context_payload,
            system_prompt=system_prompt,
            user_instructions=user_instructions,
            model=m,
            max_tokens=max_tokens,
            debug_raw=debug_raw,
            temperature=temperature,
        )

    if p == "gemini":
        from Services.AI.clients.gemini_client import gemini_call_json_model
        return gemini_call_json_model(
            context_payload=context_payload,
            system_prompt=system_prompt,
            user_instructions=user_instructions,
            model=m,
            max_tokens=max_tokens,
            debug_raw=debug_raw,
            temperature=temperature,
        )

    return AiResult(
        ok=False,
        error=AiError(code="ai_invalid_provider", message=f"Unsupported AI_PROVIDER: {p}"),
        provider=p,
        model=(m or "unknown"),
    )