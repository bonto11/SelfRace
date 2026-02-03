from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from Configs.config import (
    GEMINI_API_KEY,
    LLM_RETRIES,
    GEMINI_DEFAULT_MODEL,
    GEMINI_MODEL_FALLBACKS,
)
from Services.AI.types import AiResult, AiError
from Services.AI.json_parse import parse_ai_json

_CLIENT: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY v Configs.config")

        # FIX: Natvrdo nastavený timeout 60s priamo do klienta
        _CLIENT = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options={
                "api_version": "v1",
                "timeout": 60,
            },
        )
    return _CLIENT


def _clean_model_name(name: str) -> str:
    if not name:
        return ""
    s = str(name).strip()
    if s.lower().startswith("models/"):
        s = s.split("/", 1)[1]
    return s


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    base: List[str] = []
    if GEMINI_DEFAULT_MODEL:
        base.append(_clean_model_name(GEMINI_DEFAULT_MODEL))
    if isinstance(GEMINI_MODEL_FALLBACKS, list):
        base.extend([_clean_model_name(m) for m in GEMINI_MODEL_FALLBACKS if m])

    unique_base: List[str] = []
    for m in base:
        if m and m not in unique_base:
            unique_base.append(m)

    if not unique_base:
        unique_base = ["gemini-1.5-flash"]
    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            return [em] + [m for m in unique_base if m != em]
    return unique_base


def gemini_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    debug_raw: bool = False,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    # Systémové inštrukcie vlepíme priamo do textu, aby sme sa vyhli chybám v config poliach
    full_prompt = (
        f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\n"
        f"USER TASK:\n{user_instructions}\n\n"
        f"CONTEXT DATA (JSON):\n{ctx_json}\n\n"
        f"IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no triple backticks."
    )

    for m in models:
        for attempt in range(1, retries + 1):
            try:
                # FIX: Posielame timeout aj priamo v každom volaní cez http_options
                resp = client.models.generate_content(
                    model=m,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        temperature=float(temperature),
                        max_output_tokens=int(max_tokens),
                        http_options=types.HttpOptions(timeout=60),
                    ),
                )

                raw = (getattr(resp, "text", None) or "").strip()
                if not raw:
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                if isinstance(parsed, dict):
                    return AiResult(ok=True, data=parsed, provider="gemini", model=m)

            except Exception as e:
                last_err = f"{e.__class__.__name__}: {e}"
                if "404" in last_err:
                    break
                time.sleep(1)

    return AiResult(
        ok=False,
        data=None,
        provider="gemini",
        model="failover",
        error=AiError(
            code="ai_gemini_failed", message="All models failed or timed out."
        ),
    )
