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
    """Odstráni prefixy a biele znaky, ktoré spôsobujú 404."""
    if not name:
        return ""
    name = str(name).strip().lower()
    if name.startswith("models/"):
        name = name.replace("models/", "", 1)
    return name

def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Pripraví zoznam modelov. Ak sa v .env objaví 'flash-8b', 
    v aktuálnej verzii SDK ho radšej vynecháme kvôli nestabilite.
    """
    base: List[str] = []

    # 1. Pridaj default model z configu
    if GEMINI_DEFAULT_MODEL:
        base.append(str(GEMINI_DEFAULT_MODEL))

    # 2. Spracuj fallbacks (aj ak sú v .env ako string s čiarkou)
    fallbacks = GEMINI_MODEL_FALLBACKS
    if isinstance(fallbacks, str):
        items = [m.strip() for m in fallbacks.split(",") if m.strip()]
        base.extend(items)
    elif isinstance(fallbacks, list):
        base.extend([str(m) for m in fallbacks if m])

    # 3. Vyčisti a odfiltruj problémový 8b model
    cleaned_list: List[str] = []
    for m in base:
        c = _clean_model_name(m)
        # Ak je model 'flash-8b', preskočíme ho, kým ho Google neopraví
        if c and c not in cleaned_list and "8b" not in c:
            cleaned_list.append(c)

    # Hard fallback ak by zoznam ostal prázdny
    if not cleaned_list:
        cleaned_list = ["gemini-1.5-flash", "gemini-1.5-pro"]

    # 4. Ak prišiel explicitný model z parametra, daj ho na začiatok
    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em and "8b" not in em:
            if em in cleaned_list:
                cleaned_list.remove(em)
            cleaned_list.insert(0, em)

    return cleaned_list

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
    """
    Hlavná funkcia pre volanie Gemini s JSON výstupom.
    Integruje retries a fallbacks priamo v cykle.
    """
    if not GEMINI_API_KEY:
        return AiResult(
            ok=False, data=None, provider="gemini", model=model or "unknown",
            error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY")
        )

    client = _get_client()
    models = _models_priority(model)
    
    # Premenné z tvojho Configu
    retries = int(LLM_RETRIES or 2)
    timeout_s = int(LLM_TIMEOUT_S or 30)

    trace: Dict[str, Any] = {
        "models_tried": models,
        "attempts": [],
        "timeout_s": timeout_s
    }

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_query = f"{user_instructions.rstrip()}\n\n---\nContext JSON (ground truth):\n{ctx_json}"

    last_err: Optional[str] = None
    last_raw: Optional[str] = None

    # Vonkajší cyklus prechádza modely (failover)
    for m_name in models:
        # Vnútorný cyklus robí retries na ten istý model (napr. pri 429 Rate Limit)
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                cfg = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=float(temperature),
                    max_output_tokens=int(max_tokens),
                    response_mime_type="application/json",
                    # Timeout sa v novom SDK nastavuje v requeste, nie v configu
                )

                resp = client.models.generate_content(
                    model=m_name,
                    contents=full_user_query,
                    config=cfg,
                )

                raw = (resp.text or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                if not raw:
                    last_err = f"Empty response from {m_name}"
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw = raw_keep

                if isinstance(parsed, dict):
                    return AiResult(
                        ok=True, data=parsed, provider="gemini", model=m_name
                    )
                
                last_err = f"Invalid JSON from {m_name}"

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                err_msg = str(e)
                last_err = err_msg
                
                is_404 = _is_model_not_found_error(e)
                trace["attempts"].append({
                    "model": m_name, "attempt": attempt, "duration_ms": dur_ms, "error": err_msg
                })

                # Ak je to 404, okamžite skúsime ďalší model v zozname
                if is_404:
                    break
                
                # Inak počkáme a skúsime znova ten istý model
                time.sleep(0.5 * attempt)

    # Ak žiaden model neuspel
    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_gemini_failed",
            message=last_err or "All models failed",
            trace=(trace if debug_raw else None)
        ),
        provider="gemini",
        model=models[0] if models else "unknown"
    )