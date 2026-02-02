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
    """Inicializuje Google GenAI klienta s tvojím kľúčom."""
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY v Configs.config")
        _CLIENT = genai.Client(api_key=GEMINI_API_KEY)
    return _CLIENT

def _clean_model_name(name: str) -> str:
    """Vyčistí názov modelu od prefixov a medzier."""
    if not name:
        return ""
    name = str(name).strip().lower()
    if name.startswith("models/"):
        name = name.replace("models/", "", 1)
    return name

def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Vytvorí prioritný zoznam modelov na základe tvojho .env a explicitného parametra.
    Filtruje 'flash-8b', pretože tvoj tier ho momentálne nepodporuje (404).
    """
    candidates: List[str] = []

    # 1. Pridaj default model z tvojho .env
    if GEMINI_DEFAULT_MODEL:
        candidates.append(str(GEMINI_DEFAULT_MODEL))

    # 2. Pridaj fallback modely z tvojho .env (ošetrenie stringu aj listu)
    fallbacks = GEMINI_MODEL_FALLBACKS
    if isinstance(fallbacks, str):
        # Ak je to string s čiarkami (zo screenshotu), rozdelíme ho
        items = [m.strip() for m in fallbacks.split(",") if m.strip()]
        candidates.extend(items)
    elif isinstance(fallbacks, list):
        candidates.extend([str(m) for m in fallbacks if m])

    # 3. Vyčisti názvy a odfiltruj nefunkčné verzie (8b)
    final_list: List[str] = []
    for m in candidates:
        cleaned = _clean_model_name(m)
        # Ak model obsahuje '8b', preskočíme ho, aby sme predišli 404
        if cleaned and cleaned not in final_list and "8b" not in cleaned:
            final_list.append(cleaned)

    # Poistka pre prípad prázdneho zoznamu
    if not final_list:
        final_list = ["gemini-1.5-flash", "gemini-1.5-pro"]

    # 4. Ak bol poslaný explicitný model vo funkcii, daj ho na začiatok (ak nie je 8b)
    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em and "8b" not in em:
            if em in final_list:
                final_list.remove(em)
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
    Hlavná produkčná funkcia pre volanie Gemini s podporou JSON režimu, 
    retries, timeoutov a failoveru na ďalšie modely.
    """
    if not GEMINI_API_KEY:
        return AiResult(
            ok=False, data=None, provider="gemini", model=model or "unknown",
            error=AiError(code="ai_missing_key", message="GEMINI_API_KEY is not defined")
        )

    client = _get_client()
    models_to_try = _models_priority(model)
    
    # Načítanie tvojich configov
    retries = int(LLM_RETRIES or 2)
    # Poznámka: Nové SDK nastavuje timeout globálne alebo cez httpx, 
    # tu ho využijeme v trace logovaní.
    
    trace: Dict[str, Any] = {
        "models_tried": models_to_try,
        "attempts": [],
        "config": {
            "retries": retries,
            "timeout_s": LLM_TIMEOUT_S
        }
    }

    # Príprava promptu
    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_query = f"{user_instructions.rstrip()}\n\n---\nContext JSON (Data source):\n{ctx_json}"

    last_err: Optional[str] = None

    # Vonkajší cyklus: Skúša rôzne modely (Failover)
    for m_name in models_to_try:
        # Vnútorný cyklus: Opakované pokusy pre konkrétny model (Retries)
        for attempt in range(1, retries + 1):
            start_time = time.time()
            try:
                # Konfigurácia generovania
                gen_config = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=float(temperature),
                    max_output_tokens=int(max_tokens),
                    response_mime_type="application/json",
                )

                # Samotné volanie API
                resp = client.models.generate_content(
                    model=m_name,
                    contents=full_user_query,
                    config=gen_config,
                )

                duration_ms = int((time.time() - start_time) * 1000)
                raw_text = (resp.text or "").strip()

                if not raw_text:
                    last_err = f"Model {m_name} returned empty text."
                    continue

                # Parsovanie JSONu pomocou tvojej utility
                parsed, cleaned, raw_for_trace = parse_ai_json(raw_text)

                if isinstance(parsed, dict):
                    return AiResult(
                        ok=True,
                        data=parsed,
                        provider="gemini",
                        model=m_name
                    )
                
                last_err = f"Failed to parse JSON from {m_name}"

            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                err_msg = str(e)
                last_err = err_msg
                
                # Uložíme pokus do trace
                trace["attempts"].append({
                    "model": m_name,
                    "attempt": attempt,
                    "duration_ms": duration_ms,
                    "error": err_msg
                })

                # Ak je to 404 (model neexistuje), okamžite skúsime iný model
                if "404" in err_msg or "not_found" in err_msg.lower():
                    break
                
                # Pri iných chybách (napr. rate limit) počkáme podľa tvojho retries nastavenia
                if attempt < retries:
                    time.sleep(1 * attempt)

    # Ak žiadna kombinácia modelov a pokusov neuspela
    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_gemini_total_failure",
            message=last_err or "All configured models failed.",
            trace=(trace if debug_raw else None)
        ),
        provider="gemini",
        model="failover-chain"
    )