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
    """
    Inicializácia google-genai klienta.
    """
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY")
        # SDK si samo manažuje verziu API, v1beta je default pre určité funkcie
        _CLIENT = genai.Client(api_key=GEMINI_API_KEY)
    return _CLIENT


def _clean_model_name(name: str) -> str:
    """
    Odstráni prefixy a biele znaky, ktoré spôsobujú 404 NOT_FOUND.
    """
    if not name:
        return ""
    name = str(name).strip().lower()
    # Nové SDK pridáva models/ interne, ak ho tam máš, vznikne models/models/...
    if name.startswith("models/"):
        name = name.replace("models/", "", 1)
    return name


def _uniq_keep_order(items: List[str]) -> List[str]:
    out: List[str] = []
    for x in items:
        cleaned = _clean_model_name(x)
        if cleaned and cleaned not in out:
            out.append(cleaned)
    return out


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Pripraví zoznam modelov. Ak verzia s '-latest' padá, 
    používame stabilné verzie bez suffixu.
    """
    base: List[str] = []

    if GEMINI_DEFAULT_MODEL:
        base.append(str(GEMINI_DEFAULT_MODEL))

    if isinstance(GEMINI_MODEL_FALLBACKS, list):
        base.extend([str(m) for m in GEMINI_MODEL_FALLBACKS if m])

    # Hard fallback - tieto názvy sú pre v1beta najstabilnejšie
    if not base:
        base = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"]

    base = _uniq_keep_order(base)

    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            return _uniq_keep_order([em] + base)

    return base


def _is_model_not_found_error(e: Exception) -> bool:
    msg = str(e).upper()
    # Rozšírená detekcia pre rôzne formáty chýb z Google infraštruktúry
    return any(indicator in msg for indicator in ["404", "NOT_FOUND", "NOT_SUPPORTED", "METHOD_NOT_FOUND"])


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
        return AiResult(
            ok=False,
            data=None,
            error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY"),
            provider="gemini",
            model=model or "unknown",
        )

    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)
    
    trace: Dict[str, Any] = {
        "models_tried": models,
        "attempts": [],
    }
    
    last_err: Optional[str] = None
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_query = (
        user_instructions.rstrip()
        + "\n\n---\nContext JSON (ground truth):\n"
        + ctx_json
    )

    # Konfigurácia podľa novej dokumentácie google-genai
    cfg = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=float(temperature),
        max_output_tokens=int(max_tokens),
        response_mime_type="application/json",
    )

    for m_name in models:
        # Skúsime každý model z listu (failover na úrovni modelov)
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                # Volanie cez nové SDK: client.models.generate_content
                resp = client.models.generate_content(
                    model=m_name,
                    contents=full_user_query,
                    config=cfg,
                )

                # Získanie textu z odpovede
                raw = (resp.text or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                if not raw:
                    last_err = f"Empty response from {m_name}"
                    continue

                # Tvoj vlastný parsovač
                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                if not isinstance(parsed, dict):
                    last_err = f"Invalid JSON format from {m_name}"
                    trace["attempts"].append({"model": m_name, "ok": False, "error": last_err})
                    continue

                # ÚSPECH
                return AiResult(
                    ok=True,
                    data=parsed,
                    error=None,
                    provider="gemini",
                    model=m_name,
                )

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                err_msg = str(e)
                last_err = err_msg

                is_404 = _is_model_not_found_error(e)
                
                trace["attempts"].append({
                    "model": m_name,
                    "attempt": attempt,
                    "ok": False,
                    "duration_ms": dur_ms,
                    "error": err_msg,
                    "is_404": is_404
                })

                # Ak je to 404, nebudeme skúšať ten istý model znova, ideme na ďalší v poradí
                if is_404:
                    break
                
                # Malý delay pred retry (len ak to nie je 404)
                time.sleep(0.5 * attempt)

    # Ak sme prešli všetky modely a pokusy a nič nevyšlo
    if debug_raw:
        trace["last_raw"] = last_raw
        trace["last_cleaned"] = last_cleaned

    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_gemini_failed",
            message=last_err or "All Gemini models failed",
            trace=trace,
        ),
        provider="gemini",
        model=(models[0] if models else "unknown"),
    )