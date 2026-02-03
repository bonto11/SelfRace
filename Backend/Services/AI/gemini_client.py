from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, Union

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
            raise RuntimeError("Missing GEMINI_API_KEY v Configs.config")
        
        # Uisti sa, že timeout sú SEKUNDY (nie milisekundy)
        # Google vyžaduje int, minimum 10
        raw_val = int(LLM_TIMEOUT_S) if LLM_TIMEOUT_S else 60
        timeout_sec = max(raw_val, 60)

        _CLIENT = genai.Client(
            api_key=GEMINI_API_KEY,
            # Tu bola chyba - nepoužívaj config={}, ale priamo http_options
            http_options={
                'timeout': timeout_sec, 
                'api_version': 'v1'
            }
        )
    return _CLIENT

def _clean_model_name(name: str) -> str:
    if not name:
        return ""
    name = str(name).strip().lower()
    if name.startswith("models/"):
        name = name.replace("models/", "", 1)
    return name

def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """Určuje poradie modelov a opravuje typovú chybu 'Never'."""
    base: List[str] = []
    
    if GEMINI_DEFAULT_MODEL:
        base.append(str(GEMINI_DEFAULT_MODEL))

    # Oprava pre Pylance: Explicitne povieme, že fallbacks môže byť List alebo Str
    raw_fallbacks: Any = GEMINI_MODEL_FALLBACKS
    
    if isinstance(raw_fallbacks, list):
        base.extend([str(m) for m in raw_fallbacks if m])
    elif isinstance(raw_fallbacks, str) and raw_fallbacks:
        # Tu bola chyba "Never", pretože Pylance nevedel určiť typ
        items = [m.strip() for m in raw_fallbacks.split(",") if m.strip()]
        base.extend(items)

    unique_base: List[str] = []
    for m in base:
        cleaned = _clean_model_name(m)
        if cleaned and cleaned not in unique_base:
            unique_base.append(cleaned)

    if not unique_base:
        unique_base = ["gemini-1.5-flash"]

    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            if em in unique_base:
                unique_base.remove(em)
            return [em] + unique_base

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
    """Robustné volanie Gemini s detailným tracingom (ako OpenAI verzia)."""
    if not GEMINI_API_KEY:
        return AiResult(
            ok=False, data=None, provider="gemini", model=model or "unknown",
            error=AiError(code="ai_missing_key", message="GEMINI_API_KEY is not defined")
        )

    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)

    trace: Dict[str, Any] = {
        "models_tried": models,
        "attempts": [],
        "config": {"retries": retries, "timeout_s": LLM_TIMEOUT_S}
    }

    last_err: Optional[str] = None
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    ok_model: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    user_txt = f"{user_instructions.rstrip()}\n\n---\nContext JSON (ground truth):\n{ctx_json}"

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                # Vytvoríme si config objekt dopredu pre lepšiu čitateľnosť
                # Uprav túto časť v cykle:
                gen_config = types.GenerateContentConfig(
                    # Skús zmeniť system_instruction na zoznam častí obsahu, niekedy to pomôže stabilite
                    system_instruction=[types.Part.from_text(text=system_prompt)],
                    temperature=float(temperature),
                    max_output_tokens=int(max_tokens),
                    response_mime_type="application/json",
                    http_options=types.HttpOptions(timeout=90)
                )

                resp = client.models.generate_content(
                    model=m,
                    contents=user_txt,
                    config=gen_config
                )
                
                dur_ms = int((time.time() - started) * 1000)
                raw = (resp.text or "").strip()
                
                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": isinstance(parsed, dict),
                    "duration_ms": dur_ms, "raw_preview": raw[:200]
                })

                if isinstance(parsed, dict):
                    ok_model = m
                    if debug_raw:
                        trace.update({"raw": raw_keep, "cleaned": cleaned, "ok_model": m})
                    return AiResult(ok=True, data=parsed, provider="gemini", model=ok_model)

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = str(e)
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err
                })
                if "404" in last_err or "not_found" in last_err.lower():
                    break
                time.sleep(0.5 * attempt)

    return AiResult(
        ok=False, data=None, provider="gemini", model=ok_model or "failover",
        error=AiError(code="ai_gemini_failed", message=last_err or "Unknown", trace=(trace if debug_raw else None))
    )