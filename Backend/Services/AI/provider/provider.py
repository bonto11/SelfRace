# Services/AI/provider/provider.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from Configs.config import (
    AI_PROVIDER,
    OPENAI_DEFAULT_MODEL,
    OPENAI_MODEL_FALLBACKS,
    GEMINI_DEFAULT_MODEL,
    GEMINI_MODEL_FALLBACKS,
    GEMINI_API_KEY,
)
from Services.AI.utils.types import AiResult, AiError


def _provider() -> str:
    """Zistí aktuálne nastaveného providera (openai/gemini)."""
    return (AI_PROVIDER or "openai").strip().lower()


def _get_model_chain(provider: str, requested_model: Optional[str] = None) -> List[str]:
    """
    Vytvorí zoznam modelov na vyskúšanie.
    Ak je špecifikovanýrequested_model, ide prvý. Potom nasledujú fallbacky z configu.
    """
    chain: List[str] = []
    
    if requested_model:
        chain.append(requested_model)
        
    if provider == "openai":
        # Pridáme fallbacky z configu (už sú unikátne vďaka _csv_list v config.py)
        for m in OPENAI_MODEL_FALLBACKS:
            if m not in chain:
                chain.append(m)
        # Ak by v zozname nič nebolo, poistka na default
        if not chain:
            chain.append(OPENAI_DEFAULT_MODEL)
            
    elif provider == "gemini":
        for m in GEMINI_MODEL_FALLBACKS:
            if m not in chain:
                chain.append(m)
        if not chain:
            chain.append(GEMINI_DEFAULT_MODEL)
            
    return chain


def ai_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    """
    Univerzálne volanie AI modelu s automatickým fallbackom.
    Prechádza zoznam modelov, kým jeden úspešne neodpovie.
    """
    p = _provider()
    model_chain = _get_model_chain(p, model)
    
    attempts = []
    last_res: Optional[AiResult] = None

    # Skúšame modely jeden po druhom
    for current_model in model_chain:
        res: Optional[AiResult] = None
        
        try:
            if p == "openai":
                from Services.AI.provider.openai_client import openai_call_json_model
                res = openai_call_json_model(
                    context_payload=context_payload,
                    system_prompt=system_prompt,
                    user_instructions=user_instructions,
                    model=current_model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )

            elif p == "gemini":
                if not GEMINI_API_KEY:
                    return AiResult(
                        ok=False, data=None, provider="gemini", model=current_model,
                        error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY"),
                        trace={"models_tried": model_chain, "attempts": [], "ok_model": None}
                    )

                from Services.AI.provider.gemini_client import gemini_call_json_model
                res = gemini_call_json_model(
                    context_payload=context_payload,
                    system_prompt=system_prompt,
                    user_instructions=user_instructions,
                    model=current_model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
            
            # Ak volanie prebehlo úspešne (res.ok je True)
            if res and res.ok:
                # Upravíme trace, aby sme videli celú históriu pokusov
                if not res.trace: res.trace = {}
                res.trace["models_tried"] = model_chain
                res.trace["attempts"] = attempts
                res.trace["ok_model"] = current_model
                return res

            # Ak zlyhalo, zapíšeme si chybu a ideme na ďalší model v poradí
            error_msg = res.error.message if (res and res.error) else "Unknown error"
            attempts.append({"model": current_model, "error": error_msg})
            last_res = res

        except Exception as e:
            # Zachytenie totálneho pádu klienta (napr. 404 error v knižnici)
            attempts.append({"model": current_model, "error": str(e)})
            continue

    # Ak sme prešli celým cyklom a nič nefungovalo
    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_all_fallbacks_failed",
            message=f"Všetky modely ({', '.join(model_chain)}) zlyhali. Posledná chyba: {attempts[-1]['error'] if attempts else 'N/A'}"
        ),
        provider=p,
        model=model_chain[0] if model_chain else "unknown",
        trace={
            "models_tried": model_chain,
            "attempts": attempts,
            "ok_model": None,
        },
    )
