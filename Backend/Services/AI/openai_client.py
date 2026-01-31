# Services/AI/clients/openai_client.py
from __future__ import annotations

import os
import json
from typing import Any, Dict, Optional

from Services.AI.types import AiResult, AiUsage, ai_err

def openai_generate_text(
    *,
    system: str,
    user: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
) -> AiResult[str]:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return ai_err("ai_missing_key", "OPENAI_API_KEY is missing")

    try:
        # TODO: nahraď svojim existujúcim OpenAI klientom (u teba už je).
        # Nižšie je pseudo-call, aby si vedel presne kam to patrí.
        #
        # client = OpenAI(api_key=key)
        # resp = client.chat.completions.create(...)
        # text = resp.choices[0].message.content

        raise NotImplementedError("Wire your existing OpenAI call here")

    except NotImplementedError as e:
        return ai_err("ai_not_implemented", str(e))
    except Exception as e:  # noqa: BLE001
        return ai_err("ai_openai_error", str(e))


def openai_generate_json(
    *,
    system: str,
    user: str,
    schema: Optional[Dict[str, Any]],
    model: str,
    temperature: float,
    max_output_tokens: int,
) -> AiResult[Dict[str, Any]]:
    # Najprv spravíme “soft JSON” (LLM vráti text a my parse).
    # Neskôr vylepšíš na strict schema (response_format / json_schema).
    text_res = openai_generate_text(
        system=system,
        user=user,
        model=model,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    if not text_res.ok or not text_res.data:
        return AiResult(ok=False, error=text_res.error, provider="openai", model=model)

    raw = text_res.data.strip()
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return ai_err("ai_invalid_json", "Model returned JSON but not an object")
        return AiResult(ok=True, data=data, usage=text_res.usage, provider="openai", model=model)
    except Exception as e:
        return ai_err("ai_json_parse_failed", f"Failed to parse JSON: {e}")