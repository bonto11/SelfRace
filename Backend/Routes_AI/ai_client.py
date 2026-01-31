# Routes_AI/ai_client.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple
from fastapi import HTTPException

from Services.AI.provider import ai_call_json_model

def call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    debug_raw: bool = False,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    BACKWARD COMPAT:
    - zachová podpis aj návratový typ (parsed_json, debug_trace)
    - vnútri používa provider (OpenAI teraz, Gemini neskôr)
    """
    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_prompt,
        user_instructions=user_instructions,
        model=model,
        max_tokens=max_tokens,
        debug_raw=debug_raw,
    )

    if not res.ok or not res.data:
        if debug_raw and res.error and res.error.trace:
            raise HTTPException(status_code=500, detail={"error": res.error.message, "trace": res.error.trace})
        raise HTTPException(status_code=500, detail=(res.error.message if res.error else "AI failed"))

    trace = res.error.trace if (debug_raw and res.error and res.error.trace) else None
    # NOTE: pri success res.error je None; ak chceš trace pri success, doplň to do AiResult (môžeme).
    return res.data, trace