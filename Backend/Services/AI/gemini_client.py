# Services/AI/clients/gemini_client.py
from __future__ import annotations

import os
import json
from typing import Any, Dict, Optional

from Services.AI.types import AiResult, ai_err

def gemini_generate_text(
    *,
    system: str,
    user: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
) -> AiResult[str]:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return ai_err("ai_missing_key", "GEMINI_API_KEY is missing")

    try:
        # TODO: doplň gemini SDK call.
        # (nechávam stub, aby provider layer šiel hneď merge-núť)
        raise NotImplementedError("Wire Gemini SDK call here")
    except NotImplementedError as e:
        return ai_err("ai_not_implemented", str(e))
    except Exception as e:  # noqa: BLE001
        return ai_err("ai_gemini_error", str(e))


def gemini_generate_json(
    *,
    system: str,
    user: str,
    schema: Optional[Dict[str, Any]],
    model: str,
    temperature: float,
    max_output_tokens: int,
) -> AiResult[Dict[str, Any]]:
    text_res = gemini_generate_text(
        system=system,
        user=user,
        model=model,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    if not text_res.ok or not text_res.data:
        return AiResult(ok=False, error=text_res.error, provider="gemini", model=model)

    raw = text_res.data.strip()
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return ai_err("ai_invalid_json", "Model returned JSON but not an object")
        return AiResult(ok=True, data=data, usage=text_res.usage, provider="gemini", model=model)
    except Exception as e:
        return ai_err("ai_json_parse_failed", f"Failed to parse JSON: {e}")