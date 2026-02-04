# Services/AI/provider.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Configs.config import (
    AI_PROVIDER,
    OPENAI_DEFAULT_MODEL,
    GEMINI_DEFAULT_MODEL,
    GEMINI_API_KEY,
)
from Services.AI.types import AiResult, AiError


def _provider() -> str:
    return (AI_PROVIDER or "openai").strip().lower()


def _default_model(provider: str) -> Optional[str]:
    if provider == "openai":
        return OPENAI_DEFAULT_MODEL
    if provider == "gemini":
        return GEMINI_DEFAULT_MODEL
    return None


def ai_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    p = _provider()
    m = model or _default_model(p)

    if p == "openai":
        from Services.AI.openai_client import openai_call_json_model

        return openai_call_json_model(
            context_payload=context_payload,
            system_prompt=system_prompt,
            user_instructions=user_instructions,
            model=m,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    if p == "gemini":
        if not GEMINI_API_KEY:
            return AiResult(
                ok=False,
                data=None,
                error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY"),
                provider="gemini",
                model=(m or "unknown"),
                trace={
                    "models_tried": [m or "unknown"],
                    "attempts": [],
                    "usage": None,
                    "ok_model": None,
                },
            )

        from Services.AI.gemini_client import gemini_call_json_model

        return gemini_call_json_model(
            context_payload=context_payload,
            system_prompt=system_prompt,
            user_instructions=user_instructions,
            model=m,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_invalid_provider",
            message=f"Unsupported AI_PROVIDER: {p}",
        ),
        provider=p,
        model=(m or "unknown"),
        trace={
            "models_tried": [m or "unknown"],
            "attempts": [],
            "usage": None,
            "ok_model": None,
        },
    )