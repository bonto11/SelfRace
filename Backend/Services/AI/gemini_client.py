from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from Configs.config import (
    GEMINI_API_KEY,
    LLM_TIMEOUT_S,
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
            raise RuntimeError("Missing GEMINI_API_KEY")
        _CLIENT = genai.Client(api_key=GEMINI_API_KEY)
    return _CLIENT


def _clean_model_name(name: str) -> str:
    """Odstráni prefixy a biele znaky."""
    if not name:
        return ""
    name = str(name).strip().lower()
    if name.startswith("models/"):
        name = name.replace("models/", "", 1)
    return name


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Pripraví zoznam modelov a správne rozparsuje čiarky v .env stringu.
    """
    base: List[str] = []

    # 1. Pridaj default model
    if GEMINI_DEFAULT_MODEL:
        base.append(str(GEMINI_DEFAULT_MODEL))

    # 2. Rozparsuj fallbacky (ošetrenie stringu z .env aj listu)
    fallbacks = GEMINI_MODEL_FALLBACKS
    if isinstance(fallbacks, str):
        # Ak je to string "model1,model2", rozbi ho na list
        items = [m.strip() for m in fallbacks.split(",") if m.strip()]
        base.extend(items)
    elif isinstance(fallbacks, list):
        base.extend([str(m) for m in fallbacks if m])

    # 3. Ak je zoznam prázdny, použi overené stabilné názvy
    if not base:
        base = ["gemini-1.5-flash", "gemini-1.5-pro"]

    # Vyčisti názvy a odstráň duplikáty
    final_list: List[str] = []
    for m in base:
        cleaned = _clean_model_name(m)
        if cleaned and cleaned not in final_list:
            final_list.append(cleaned)

    # 4. Ak prišiel explicitný model, daj ho na začiatok
    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            if em in final_list:
                final_list.remove(em)
            final_list.insert(0, em)

    return final_list


def _is_model_not_found_error(e: Exception) -> bool:
    msg = str(e).upper()
    return any(x in msg for x in ["404", "NOT_FOUND", "NOT_SUPPORTED", "METHOD_NOT_FOUND"])


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
    if not GEMINI_API_KEY:
        return AiResult(ok=False, data=None, error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY"), provider="gemini", model=model or "unknown")

    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)
    
    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_err: Optional[str] = None
    last_raw: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_query = f"{user_instructions.rstrip()}\n\n---\nContext JSON (ground truth):\n{ctx_json}"

    cfg = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=float(temperature),
        max_output_tokens=int(max_tokens),
        response_mime_type="application/json",
    )

    for m_name in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                # DÔLEŽITÉ: Tu voláme model bez "models/" prefixu
                resp = client.models.generate_content(
                    model=m_name,
                    contents=full_user_query,
                    config=cfg,
                )

                raw = (resp.text or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                if not raw:
                    last_err = f"Empty text from {m_name}"
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw = raw_keep

                if not isinstance(parsed, dict):
                    last_err = f"Invalid JSON from {m_name}"
                    continue

                return AiResult(ok=True, data=parsed, error=None, provider="gemini", model=m_name)

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                err_msg = str(e)
                last_err = err_msg
                is_404 = _is_model_not_found_error(e)
                
                trace["attempts"].append({
                    "model": m_name, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": err_msg
                })

                if is_404:
                    break # Prejdi na ďalší model v zozname
                
                time.sleep(0.5 * attempt)

    return AiResult(
        ok=False,
        data=None,
        error=AiError(code="ai_gemini_failed", message=last_err or "Fail", trace=(trace if debug_raw else None)),
        provider="gemini",
        model=models[0] if models else "unknown"
    )