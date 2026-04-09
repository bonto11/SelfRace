# Services/AI/provider/gemini_client.py
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
    LLM_TIMEOUT_S,
)
from Services.AI.utils.types import AiResult, AiError
from Services.AI.utils.json_parse import parse_ai_json

_CLIENT: Optional[genai.Client] = None

def _get_client() -> genai.Client:
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY v Configs.config")
        
        timeout_ms = int(float(LLM_TIMEOUT_S or 300.0) * 1000)
        
        _CLIENT = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options={"timeout": timeout_ms},
        )
    return _CLIENT

def _clean_model_name(name: str) -> str:
    s = (name or "").strip()
    if s.lower().startswith("models/"):
        s = s.split("/", 1)[1]
    return s

def _models_priority(explicit_model: Optional[str]) -> List[str]:
    base: List[str] = []
    if GEMINI_DEFAULT_MODEL:
        base.append(_clean_model_name(GEMINI_DEFAULT_MODEL))
    if isinstance(GEMINI_MODEL_FALLBACKS, list):
        base.extend([_clean_model_name(m) for m in GEMINI_MODEL_FALLBACKS if m])

    unique: List[str] = []
    for m in base:
        if m and m not in unique:
            unique.append(m)

    if not unique:
        unique = ["gemini-2.5-flash"]

    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            return [em] + [m for m in unique if m != em]
    return unique

def _extract_usage(resp: Any) -> Optional[Dict[str, int]]:
    um = getattr(resp, "usage_metadata", None)
    if um is None:
        return None
    try:
        prompt = int(getattr(um, "prompt_token_count", 0) or 0)
        completion = int(getattr(um, "candidates_token_count", 0) or 0)
        total = int(getattr(um, "total_token_count", 0) or 0)
        if prompt == 0 and completion == 0 and total == 0:
            return None
        if total == 0:
            total = prompt + completion
        return {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": total,
            "reasoning_tokens": 0,
        }
    except Exception:
        return None

def gemini_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 4000,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)

    trace: Dict[str, Any] = {
        "provider": "gemini",
        "models_tried": models,
        "attempts": [],
        "usage": None,
        "ok_model": None,
    }

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    
    full_user_prompt = (
        f"USER TASK:\n{user_instructions}\n\n"
        f"CONTEXT DATA (JSON):\n{ctx_json}"
    )

    last_err: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=full_user_prompt,
                    config=types.GenerateContentConfig(
                        temperature=float(temperature),
                        max_output_tokens=8192, # MAGICKÁ OPRAVA: Tvrdý, obrovský limit, nech ho nič nezastaví!
                        system_instruction=system_prompt,
                        safety_settings=[
                            types.SafetySetting(
                                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                                threshold=types.HarmBlockThreshold.BLOCK_NONE,
                            ),
                            types.SafetySetting(
                                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                                threshold=types.HarmBlockThreshold.BLOCK_NONE,
                            ),
                            types.SafetySetting(
                                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                                threshold=types.HarmBlockThreshold.BLOCK_NONE,
                            ),
                            types.SafetySetting(
                                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                threshold=types.HarmBlockThreshold.BLOCK_NONE,
                            ),
                        ]
                    ),
                )

                raw = (getattr(resp, "text", None) or "").strip()
                dur_ms = int((time.time() - started) * 1000)
                
                # Zistíme PREČO Google prestal písať
                # Zistíme PREČO Google prestal písať
                finish_reason = "UNKNOWN"
                try:
                    if resp.candidates and len(resp.candidates) > 0:
                        finish_reason = str(resp.candidates[0].finish_reason)
                except Exception:
                    pass

                if not raw:
                    last_err = f"Gemini returned empty text. Finish reason: {finish_reason}"
                    trace["attempts"].append({"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err})
                    continue

                b_ticks = chr(96) * 3
                if raw.startswith(b_ticks):
                    raw = raw.replace(b_ticks + "json", "").replace(b_ticks, "").strip()

                start_idx = raw.find('{')
                end_idx = raw.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    raw = raw[start_idx:end_idx+1]

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                ok = isinstance(parsed, dict)

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": ok,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:600] + ("...[truncated]" if len(raw) > 600 else ""),
                    }
                )

                if not ok:
                    print("\n" + "="*50)
                    print(f"[GEMINI DEV] GOOGLE FINISH REASON: {finish_reason}")
                    print("[GEMINI DEV] FULL RAW OUTPUT START:")
                    print(raw)
                    print("[GEMINI DEV] FULL RAW OUTPUT END")
                    print("="*50 + "\n")

                    last_err = f"Invalid JSON. Google Finish Reason: {finish_reason}"
                    continue

                trace["ok_model"] = m
                u = _extract_usage(resp)
                if u:
                    trace["usage"] = u

                return AiResult(ok=True, data=parsed, error=None, provider="gemini", model=m, trace=trace)

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                print(f"[GEMINI DEV] Attempt {attempt} failed on {m}: {last_err}")
                trace["attempts"].append({"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err})
                
                if "404" in last_err or "429" in last_err:
                    break
                
                time.sleep(1.0 * attempt)

    return AiResult(
        ok=False,
        data=None,
        provider="gemini",
        model=(models[0] if models else "unknown"),
        error=AiError(code="ai_gemini_failed", message=(last_err or "All models failed.")),
        trace=trace,
    )

def get_gemini_models() -> List[str]:
    """Vráti zoznam dostupných Gemini modelov."""
    client = _get_client() # Toto nám zaručí, že máme API kľúč aj timeout
    
    models = client.models.list()
    # Zaujímajú nás len modely schopné generovať obsah (text)
    # Prefix 'models/' rovno odstránime pre čistejší výpis
    valid_models = []
    for m in models:
        # V novom SDK sú metódy dostupné cez m.supported_generation_methods
        if hasattr(m, "supported_generation_methods") and "generateContent" in getattr(m, "supported_generation_methods", []):
            name = m.name.replace("models/", "") if m.name else "unknown"
            valid_models.append(name)
            
    return sorted(valid_models)