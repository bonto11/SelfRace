# Services/AI/provider/provider.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from Configs.config import (
    AI_PROVIDER,
    OPENAI_API_KEY,
    OPENAI_MODEL_FALLBACKS,
    GEMINI_API_KEY,
    GEMINI_MODEL_FALLBACKS,
    CLAUDE_API_KEY,
    CLAUDE_MODEL_FALLBACKS,
)
from Services.AI.utils.types import AiResult, AiError
from Services.AI.provider.openai_client import get_openai_models, openai_call_json_model
from Services.AI.provider.gemini_client import get_gemini_models, gemini_call_json_model
from Services.AI.provider.claude_client import get_claude_models, claude_call_json_model

# =============================================================================
# STATICKÁ KONFIGURÁCIA PROVIDEROV
# =============================================================================

_PROVIDER_KEYS: Dict[str, Optional[str]] = {
    "openai": OPENAI_API_KEY,
    "gemini": GEMINI_API_KEY,
    "claude": CLAUDE_API_KEY,
}

_PROVIDER_FALLBACKS: Dict[str, List[str]] = {
    "openai": OPENAI_MODEL_FALLBACKS or [],
    "gemini": GEMINI_MODEL_FALLBACKS or [],
    "claude": CLAUDE_MODEL_FALLBACKS or [],
}

_PROVIDER_CALL = {
    "openai": openai_call_json_model,
    "gemini": gemini_call_json_model,
    "claude": claude_call_json_model,
}

_PROVIDER_MODELS = {
    "openai": get_openai_models,
    "gemini": get_gemini_models,
    "claude": get_claude_models,
}

# Poradie záchrannej siete — primárny provider sa preskočí automaticky
_FALLBACK_ORDER: List[str] = ["gemini", "openai", "claude"]

_VALID_PROVIDERS = set(_PROVIDER_KEYS.keys())


# =============================================================================
# HELPERS
# =============================================================================

def _get_primary_provider() -> str:
    p = (AI_PROVIDER or "gemini").strip().lower()
    if p not in _VALID_PROVIDERS:
        print(f"[PROVIDER] Neznámy AI_PROVIDER='{p}', fallback na 'gemini'")
        return "gemini"
    return p


def _build_chain(primary: str, requested_model: Optional[str]) -> List[Tuple[str, str]]:
    """
    Zostaví poradovník (provider, model) pre jedno volanie.

    Poradie:
      1. Primárny provider — requested_model ak zadaný, potom jeho fallbacky
      2. Ostatní provideri v _FALLBACK_ORDER — len ich fallbacky
    """
    chain: List[Tuple[str, str]] = []

    # 1. Primárny provider
    primary_models: List[str] = []
    if requested_model:
        primary_models.append(requested_model.strip())
    for m in _PROVIDER_FALLBACKS[primary]:
        if m and m not in primary_models:
            primary_models.append(m)

    for m in primary_models:
        chain.append((primary, m))

    # 2. Záchranná sieť
    for p in _FALLBACK_ORDER:
        if p == primary:
            continue
        for m in _PROVIDER_FALLBACKS[p]:
            if m:
                chain.append((p, m.strip()))

    return chain


def _call_provider(
    provider: str,
    model: str,
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    max_tokens: int,
    temperature: float,
) -> AiResult:
    return _PROVIDER_CALL[provider](
        context_payload=context_payload,
        system_prompt=system_prompt,
        user_instructions=user_instructions,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )


# =============================================================================
# HLAVNÁ FUNKCIA
# =============================================================================

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
    Volanie AI s automatickým cross-provider fallbackom.
    Primárny provider sa nastaví cez AI_PROVIDER env var.
    """
    primary = _get_primary_provider()
    chain = _build_chain(primary, model)
    attempts: List[Dict[str, Any]] = []

    for provider, m in chain:
        # Preskočíme ak chýba API kľúč
        if not _PROVIDER_KEYS.get(provider):
            attempts.append({
                "provider": provider,
                "model": m,
                "error": f"Chýba API kľúč pre '{provider}'",
            })
            continue

        try:
            res = _call_provider(
                provider, m,
                context_payload=context_payload,
                system_prompt=system_prompt,
                user_instructions=user_instructions,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            if res and res.ok:
                if not res.trace:
                    res.trace = {}
                res.trace["attempts"] = attempts
                res.trace["ok_provider"] = provider
                res.trace["ok_model"] = m
                res.provider = provider
                res.model = m
                return res

            err = res.error.message if (res and res.error) else "Neznáma chyba"
            attempts.append({"provider": provider, "model": m, "error": err})

        except Exception as e:
            attempts.append({"provider": provider, "model": m, "error": f"{type(e).__name__}: {e}"})

    # Všetci zlyhali
    tried = ", ".join(f"{a['provider']}:{a['model']}" for a in attempts)
    last_err = attempts[-1]["error"] if attempts else "N/A"

    return AiResult(
        ok=False,
        data=None,
        provider=primary,
        model=model or "unknown",
        error=AiError(
            code="ai_cross_provider_failed",
            message=f"Zlyhali všetci provideri. Skúšané: ({tried}). Posledná chyba: {last_err}",
        ),
        trace={"attempts": attempts, "ok_model": None},
    )


# =============================================================================
# MONITORING / HEALTH
# =============================================================================

def get_available_ai_models() -> Dict[str, Any]:
    """Zoznam modelov od každého providera + nakonfigurované modely."""
    result: Dict[str, Any] = {
        p: [] for p in _VALID_PROVIDERS
    }
    result["configured"] = {p: _PROVIDER_FALLBACKS[p] for p in _VALID_PROVIDERS}
    result["errors"] = []

    for p, fn in _PROVIDER_MODELS.items():
        try:
            result[p] = fn()
        except Exception as e:
            result["errors"].append(f"{p}: {e}")

    return result


def check_configured_models_health() -> Dict[str, Any]:
    """Porovná nakonfigurované modely s reálne dostupnými."""
    available = get_available_ai_models()
    missing: Dict[str, List[str]] = {}

    for p in _VALID_PROVIDERS:
        available_models = available.get(p, [])
        missing[p] = [m for m in _PROVIDER_FALLBACKS[p] if m not in available_models]

    api_errors = available.get("errors", [])
    is_ok = not any(missing.values()) and not api_errors

    return {"ok": is_ok, "missing": missing, "api_errors": api_errors}


def get_ai_health_status() -> Tuple[bool, str]:
    """Jednoduchý health check pre externé služby."""
    health = check_configured_models_health()

    if health["ok"]:
        return True, ""

    alerts: List[str] = []
    for p, models in health["missing"].items():
        if models:
            alerts.append(f"Chýba {p}: {', '.join(models)}")
    if health["api_errors"]:
        alerts.append(f"API chyby: {', '.join(health['api_errors'])}")

    return False, " | ".join(alerts)