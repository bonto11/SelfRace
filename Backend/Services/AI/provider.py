# Services/AI/provider.py
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from Services.AI.types import AiResult, ai_err

def _get_provider_name() -> str:
    return (os.getenv("AI_PROVIDER") or "openai").strip().lower()

def _get_default_model(provider: str) -> str:
    if provider == "gemini":
        return os.getenv("GEMINI_MODEL_DEFAULT") or "gemini-1.5-flash"
    return os.getenv("OPENAI_MODEL_DEFAULT") or "gpt-4o-mini"


def ai_generate_json(
    *,
    system: str,
    user: str,
    schema: Optional[Dict[str, Any]] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 1200,
) -> AiResult[Dict[str, Any]]:
    """
    Vráti JSON dict. schema je voliteľná (pre neskorší strict mode).
    """
    provider = _get_provider_name()
    use_model = model or _get_default_model(provider)

    try:
        if provider == "gemini":
            from Services.AI.clients.gemini_client import gemini_generate_json
            return gemini_generate_json(
                system=system,
                user=user,
                schema=schema,
                model=use_model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )

        if provider == "openai":
            from Services.AI.clients.openai_client import openai_generate_json
            return openai_generate_json(
                system=system,
                user=user,
                schema=schema,
                model=use_model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )

        return ai_err("ai_invalid_provider", f"Unsupported AI_PROVIDER: {provider}")

    except Exception as e:  # noqa: BLE001
        return ai_err("ai_provider_error", str(e))


def ai_generate_text(
    *,
    system: str,
    user: str,
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
) -> AiResult[str]:
    provider = _get_provider_name()
    use_model = model or _get_default_model(provider)

    try:
        if provider == "gemini":
            from Services.AI.clients.gemini_client import gemini_generate_text
            return gemini_generate_text(
                system=system,
                user=user,
                model=use_model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )

        if provider == "openai":
            from Services.AI.clients.openai_client import openai_generate_text
            return openai_generate_text(
                system=system,
                user=user,
                model=use_model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )

        return ai_err("ai_invalid_provider", f"Unsupported AI_PROVIDER: {provider}")

    except Exception as e:  # noqa: BLE001
        return ai_err("ai_provider_error", str(e))