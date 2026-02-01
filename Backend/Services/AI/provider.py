# Services/AI/provider.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Configs.config import (
    AI_PROVIDER,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    OPENAI_DEFAULT_MODEL,
    GEMINI_DEFAULT_MODEL,
)
from Services.AI.types import AiResult, AiError


def _provider() -> str:
    p = (AI_PROVIDER or "openai").strip().lower()
    # normalizácia aliasov
    if p in ("google", "gai", "gemini"):
        return "gemini"
    if p in ("openai", "oa"):
        return "openai"
    return p


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
    max_tokens: Optional[int] = None,
    debug_raw: bool = False,
    temperature: Optional[float] = None,
) -> AiResult[Dict[str, Any]]:
    """
    Jediný vstup pre celý backend.
    - provider a default model sú v Configs.config
    - max_tokens/temperature sú globálne (LLM_*) ale dajú sa override-núť parametrom
    """
    p = _provider()
    m = model or _default_model(p)

    mt = int(max_tokens if max_tokens is not None else (LLM_MAX_TOKENS or 2000))
    temp = float(temperature if temperature is not None else (LLM_TEMPERATURE or 0.2))

    if p == "openai":
        from Services.AI.clients.openai_client import openai_call_json_model

        return openai_call_json_model(
            context_payload=context_payload,
            system_prompt=system_prompt,
            user_instructions=user_instructions,
            model=m,
            max_tokens=mt,
            debug_raw=debug_raw,
            temperature=temp,
        )

    if p == "gemini":
        from Services.AI.clients.gemini_client import gemini_call_json_model

        return gemini_call_json_model(
            context_payload=context_payload,
            system_prompt=system_prompt,
            user_instructions=user_instructions,
            model=m,
            max_tokens=mt,
            debug_raw=debug_raw,
            temperature=temp,
        )

    return AiResult(
        ok=False,
        data=None,
        error=AiError(code="ai_invalid_provider", message=f"Unsupported AI_PROVIDER: {p}"),
        provider=p,
        model=(m or "unknown"),
    )