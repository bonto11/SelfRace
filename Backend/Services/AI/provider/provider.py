# Services/AI/provider/provider.py
from __future__ import annotations

from typing import Any, Dict, Optional, List, Tuple

from Configs.config import (
    AI_PROVIDER,
    OPENAI_DEFAULT_MODEL,
    OPENAI_MODEL_FALLBACKS,
    GEMINI_DEFAULT_MODEL,
    GEMINI_MODEL_FALLBACKS,
    GEMINI_API_KEY,
    OPENAI_API_KEY, # Pridaný import pre kontrolu kľúča
)

from Services.AI.utils.types import AiResult, AiError
from Services.AI.provider.openai_client import get_openai_models, openai_call_json_model
from Services.AI.provider.gemini_client import get_gemini_models, gemini_call_json_model

def _provider() -> str:
    """Zistí aktuálne nastaveného primárneho providera."""
    return (AI_PROVIDER or "openai").strip().lower()


def _get_full_chain(primary_p: str, requested_model: Optional[str] = None) -> List[Tuple[str, str]]:
    """
    Vytvorí kompletný poradovník (Provider, Model).
    Príklad pre Gemini:
    1. Gemini (requested alebo default)
    2. Gemini Fallbacky
    3. OpenAI Fallbacky (ako záchrana)
    """
    full_chain: List[Tuple[str, str]] = []
    
    # Určíme, kto je druhý v poradí
    secondary_p = "openai" if primary_p == "gemini" else "gemini"
    
    # --- 1. PRIMÁRNY PROVIDER ---
    p_models = []
    if requested_model:
        p_models.append(requested_model)
    
    # Pridáme fallbacky primárneho providera z configu
    primary_fallbacks = GEMINI_MODEL_FALLBACKS if primary_p == "gemini" else OPENAI_MODEL_FALLBACKS
    for m in primary_fallbacks:
        if m not in p_models:
            p_models.append(m)
            
    for m in p_models:
        full_chain.append((primary_p, m))
        
    # --- 2. SEKUNDÁRNY PROVIDER (Záchranná sieť) ---
    secondary_fallbacks = OPENAI_MODEL_FALLBACKS if secondary_p == "openai" else GEMINI_MODEL_FALLBACKS
    for m in secondary_fallbacks:
        full_chain.append((secondary_p, m))
        
    return full_chain


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
    Volanie AI s Cross-Provider fallbackom. 
    Ak zlyhá Gemini, automaticky skúša OpenAI (a naopak).
    """
    primary_p = _provider()
    # Získame zoznam (provider, model) v poradí, v akom ich budeme skúšať
    full_chain = _get_full_chain(primary_p, model)
    
    attempts = []

    # Ideme rad za radom cez celý chain
    for p, m in full_chain:
        try:
            # Kontrola, či máme API kľúč pre daného providera v aktuálnom kroku
            if p == "gemini" and not GEMINI_API_KEY:
                attempts.append({"provider": p, "model": m, "error": "Chýba Gemini API kľúč"})
                continue
            if p == "openai" and not OPENAI_API_KEY:
                attempts.append({"provider": p, "model": m, "error": "Chýba OpenAI API kľúč"})
                continue

            res: Optional[AiResult] = None
            
            # Volanie konkrétneho klienta
            if p == "openai":
                res = openai_call_json_model(
                    context_payload=context_payload,
                    system_prompt=system_prompt,
                    user_instructions=user_instructions,
                    model=m,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
            elif p == "gemini":
                res = gemini_call_json_model(
                    context_payload=context_payload,
                    system_prompt=system_prompt,
                    user_instructions=user_instructions,
                    model=m,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
            
            # Ak to klaplo, vrátime výsledok a do trace zapíšeme cestu, ktorá uspela
            if res and res.ok:
                if not res.trace: res.trace = {}
                res.trace["attempts"] = attempts
                res.trace["ok_model"] = m
                res.trace["ok_provider"] = p
                # Nastavíme finálny model a providera na výsledok
                res.model = m
                res.provider = p
                return res

            # Ak zlyhalo, zapíšeme chybu a slučka skúsi ďalšieho (model alebo providera)
            error_msg = res.error.message if (res and res.error) else "Neznáma chyba"
            attempts.append({"provider": p, "model": m, "error": error_msg})

        except Exception as e:
            # Zachytenie pádov (napr. 503 alebo 404 priamo z knižnice)
            attempts.append({"provider": p, "model": m, "error": str(e)})
            continue

    # Ak sme vyčerpali úplne všetko (Gemini aj OpenAI fallbacky)
    tried_summary = ", ".join([f"{a['provider']}:{a['model']}" for a in attempts])
    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_cross_provider_failed",
            message=f"Zlyhali všetci provideri. Skúšané: ({tried_summary}). Posledná chyba: {attempts[-1]['error'] if attempts else 'N/A'}"
        ),
        provider=primary_p,
        model=model or "unknown",
        trace={
            "attempts": attempts,
            "ok_model": None
        },
    )

def get_available_ai_models() -> Dict[str, Any]:
    """
    Združí dostupné modely z OpenAI aj Gemini a pripojí aktuálnu konfiguráciu.
    """
    from Configs.config import (
        OPENAI_DEFAULT_MODEL, OPENAI_MODEL_FALLBACKS,
        GEMINI_DEFAULT_MODEL, GEMINI_MODEL_FALLBACKS
    )

    result: Dict[str, Any] = {
        "openai": [],
        "gemini": [],
        "configured": {
            "openai": [],
            "gemini": []
        },
        "errors": []
    }

    # 1. Zostavenie zoznamu nastavených modelov (odstránenie duplicít)
    cfg_openai = [OPENAI_DEFAULT_MODEL] + (OPENAI_MODEL_FALLBACKS or [])
    cfg_gemini = [GEMINI_DEFAULT_MODEL] + (GEMINI_MODEL_FALLBACKS or [])
    
    result["configured"]["openai"] = list(dict.fromkeys([str(m).strip() for m in cfg_openai if m]))
    result["configured"]["gemini"] = list(dict.fromkeys([str(m).strip() for m in cfg_gemini if m]))

    # 2. OpenAI Modely z API
    try:
        result["openai"] = get_openai_models()
    except Exception as e:
        result["errors"].append(f"OpenAI: {str(e)}")

    # 3. Gemini Modely z API
    try:
        result["gemini"] = get_gemini_models()
    except Exception as e:
        result["errors"].append(f"Gemini: {str(e)}")

    return result

def check_configured_models_health() -> Dict[str, Any]:
    """
    Porovná modely nastavené v Configu s reálne dostupnými modelmi z API.
    Vráti report, ak nejaký nakonfigurovaný model chýba.
    """
    
    # Získame reálne dostupné modely (funkciu už máme)
    available = get_available_ai_models()

    # Zozbierame všetky naše nastavené modely a odstránime duplicity/prázdne
    cfg_openai = list(set([m for m in [OPENAI_DEFAULT_MODEL] + OPENAI_MODEL_FALLBACKS if m]))
    cfg_gemini = list(set([m for m in [GEMINI_DEFAULT_MODEL] + GEMINI_MODEL_FALLBACKS if m]))

    # Ktoré z našich modelov sa NENACHÁDZAJÚ v zozname od providera?
    missing_openai = [m for m in cfg_openai if m not in available.get("openai", [])]
    missing_gemini = [m for m in cfg_gemini if m not in available.get("gemini", [])]
    api_errors = available.get("errors", [])

    is_ok = not missing_openai and not missing_gemini and not api_errors

    return {
        "ok": is_ok,
        "missing_openai": missing_openai,
        "missing_gemini": missing_gemini,
        "api_errors": api_errors
    }