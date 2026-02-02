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
    """Inicializácia klienta."""
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY")
        _CLIENT = genai.Client(api_key=GEMINI_API_KEY)
    return _CLIENT

def _clean_model_name(name: str) -> str:
    """Vyčistí názov modelu od balastu."""
    if not name: return ""
    return str(name).strip().lower().replace("models/", "")

def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Vytvorí zoznam modelov. 
    POZOR: Natvrdo vyhadzujeme 'flash-8b', kým nemáš aktívny billing, 
    pretože ten model na free kľúčoch v EÚ momentálne hádže 404.
    """
    candidates = []
    
    # Pridáme default z tvojho env (na screenshote máš gemini-1.5-flash)
    if GEMINI_DEFAULT_MODEL:
        candidates.append(str(GEMINI_DEFAULT_MODEL))
    
    # Pridáme fallbacky (rozdelíme čiarku zo screenshotu)
    fallbacks = GEMINI_MODEL_FALLBACKS
    if isinstance(fallbacks, str):
        candidates.extend([m.strip() for m in fallbacks.split(",") if m.strip()])
    
    # Vyčistíme a odfiltrujeme nefunkčné
    final_list = []
    for m in candidates:
        c = _clean_model_name(m)
        if c and c not in final_list and "8b" not in c:
            final_list.append(c)
            
    # Ak by všetko zlyhalo, skúsime aspoň stabilný flash
    if not final_list:
        final_list = ["gemini-1.5-flash", "gemini-1.5-pro"]
        
    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em and "8b" not in em:
            if em in final_list: final_list.remove(em)
            final_list.insert(0, em)
            
    return final_list

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
    Kompletná funkcia pre Selfrace AI analýzu.
    """
    if not GEMINI_API_KEY:
        return AiResult(ok=False, data=None, provider="gemini", model="unknown",
                         error=AiError(code="ai_missing_key", message="Missing API Key"))

    client = _get_client()
    models_to_try = _models_priority(model)
    retries = int(LLM_RETRIES or 2)
    
    last_err = "No models available"

    for m_name in models_to_try:
        # Skúšame model
        for attempt in range(1, retries + 1):
            try:
                cfg = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=float(temperature),
                    max_output_tokens=int(max_tokens),
                    response_mime_type="application/json",
                )
                
                # Payload pre AI
                content = f"{user_instructions}\n\nContext Data:\n{json.dumps(context_payload, ensure_ascii=False)}"
                
                resp = client.models.generate_content(
                    model=m_name,
                    contents=content,
                    config=cfg
                )

                if not resp.text:
                    last_err = f"Empty response from {m_name}"
                    continue

                parsed, _, _ = parse_ai_json(resp.text)
                if isinstance(parsed, dict):
                    return AiResult(ok=True, data=parsed, provider="gemini", model=m_name)
                
            except Exception as e:
                last_err = str(e)
                # Ak je to 404 (model not found), hneď skúsime iný model zo zoznamu
                if "404" in last_err or "not found" in last_err.lower():
                    break 
                time.sleep(0.5 * attempt)

    return AiResult(
        ok=False,
        data=None,
        error=AiError(code="ai_gemini_failed", message=last_err),
        provider="gemini",
        model="failover"
    )