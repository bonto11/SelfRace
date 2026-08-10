# Services/AI/provider/provider.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from Configs.config import (
    AI_PROVIDER,
    OPENAI_API_KEY,
    OPENAI_DEFAULT_MODEL,
    OPENAI_MODEL_FALLBACKS,
    GEMINI_API_KEY,
    GEMINI_DEFAULT_MODEL,
    GEMINI_MODEL_FALLBACKS,
    CLAUDE_API_KEY,
    CLAUDE_DEFAULT_MODEL,
    CLAUDE_MODEL_FALLBACKS,
)
from Services.AI.utils.types import AiResult, AiError
from Services.AI.provider.openai_client import get_openai_models, openai_call_json_model
from Services.AI.provider.gemini_client import get_gemini_models, gemini_call_json_model
from Services.AI.provider.claude_client import get_claude_models, claude_call_json_model

# =============================================================================
# KONFIGURÁCIA
# =============================================================================

# Poradie záchrannej siete — primárny sa preskočí automaticky
_FALLBACK_ORDER: List[str] = ["claude", "gemini", "openai"]

_VALID_PROVIDERS = {"claude", "gemini", "openai"}

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


# =============================================================================
# HELPERS
# =============================================================================

def _get_api_key(provider: str) -> Optional[str]:
    """Číta API kľúč live — nie z dict načítaného pri importe."""
    if provider == "claude":
        return CLAUDE_API_KEY
    if provider == "gemini":
        return GEMINI_API_KEY
    if provider == "openai":
        return OPENAI_API_KEY
    return None


def _get_provider_models(provider: str) -> List[str]:
    """
    Vráti zoradený zoznam modelov pre providera: [default, ...fallbacks].
    Default je vždy prvý — to je ten ktorý sa volá ako prvý.
    Duplicity sa odstránia, poradie sa zachová.
    """
    if provider == "claude":
        default = CLAUDE_DEFAULT_MODEL
        fallbacks = CLAUDE_MODEL_FALLBACKS or []
    elif provider == "gemini":
        default = GEMINI_DEFAULT_MODEL
        fallbacks = GEMINI_MODEL_FALLBACKS or []
    elif provider == "openai":
        default = OPENAI_DEFAULT_MODEL
        fallbacks = OPENAI_MODEL_FALLBACKS or []
    else:
        return []

    # default prvý, potom fallbacky bez duplikátov
    seen: set = set()
    result: List[str] = []
    for m in ([default] + list(fallbacks)):
        m = (m or "").strip()
        if m and m not in seen:
            seen.add(m)
            result.append(m)
    return result


def _get_primary_provider() -> str:
    """Prečíta AI_PROVIDER z ENV — fallback na claude ak neznámy."""
    p = (AI_PROVIDER or "claude").strip().lower()
    if p not in _VALID_PROVIDERS:
        print(f"[PROVIDER] ⚠️  Neznámy AI_PROVIDER='{p}', fallback na 'claude'")
        return "claude"
    return p


def _build_chain(primary: str, requested_model: Optional[str]) -> List[Tuple[str, str]]:
    """
    Zostaví poradovník (provider, model):

    1. Primárny provider:
       - ak je requested_model → ten prvý, potom default + fallbacky
       - inak → default, potom fallbacky

    2. Ostatní provideri v poradí _FALLBACK_ORDER (primárny preskočený):
       - každý začína svojim defaultom, potom fallbacky

    Príklad pre AI_PROVIDER=claude:
      claude:haiku → claude:sonnet → gemini:flash → gemini:flash-lite → openai:gpt-4o-mini → openai:gpt-4o
    """
    chain: List[Tuple[str, str]] = []

    # 1. Primárny provider
    primary_models = _get_provider_models(primary)
    if requested_model:
        req = requested_model.strip()
        # requested_model ide úplne prvý, default+fallbacky za ním (bez duplikátu)
        ordered = [req] + [m for m in primary_models if m != req]
    else:
        ordered = primary_models

    for m in ordered:
        chain.append((primary, m))

    # 2. Záchranná sieť — ostatní provideri v definovanom poradí
    for p in _FALLBACK_ORDER:
        if p == primary:
            continue
        for m in _get_provider_models(p):
            chain.append((p, m))

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
    """Zavolá konkrétneho AI providera."""
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
    Poradie: primárny provider (default → fallbacky) → ostatní v poradí _FALLBACK_ORDER.
    Chyby loguje, úspech nie.
    """
    import time

    primary = _get_primary_provider()
    chain = _build_chain(primary, model)
    attempts: List[Dict[str, Any]] = []

    for attempt_num, (provider, m) in enumerate(chain, start=1):
        started = time.time()

        # Live check API kľúča
        if not _get_api_key(provider):
            err = f"Chýba API kľúč pre '{provider}'"
            print(f"[PROVIDER] ❌ {provider}:{m} — {err}")
            attempts.append({"provider": provider, "model": m, "error": err})
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
            dur_ms = int((time.time() - started) * 1000)

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
            print(f"[PROVIDER] ❌ attempt#{attempt_num} {provider}:{m} ({dur_ms}ms) — {err}")
            attempts.append({"provider": provider, "model": m, "error": err})

        except Exception as e:
            dur_ms = int((time.time() - started) * 1000)
            err = f"{type(e).__name__}: {e}"
            print(f"[PROVIDER] ❌ attempt#{attempt_num} {provider}:{m} ({dur_ms}ms) — {err}")
            attempts.append({"provider": provider, "model": m, "error": err})

    # Všetci zlyhali
    tried = ", ".join(f"{a['provider']}:{a['model']}" for a in attempts)
    last_err = attempts[-1]["error"] if attempts else "N/A"
    print(f"[PROVIDER] 💀 ALL FAILED. Tried: {tried}")

    return AiResult(
        ok=False,
        data=None,
        provider=primary,
        model=model or "unknown",
        error=AiError(
            code="ai_cross_provider_failed",
            message=f"Zlyhali všetci provideri. Skúšané: ({tried}). Posledná chyba: {last_err}",
        ),
        trace={"attempts": attempts, "ok_model": None, "ok_provider": None},
    )


# =============================================================================
# MONITORING / HEALTH
# =============================================================================

# Claude zatiaľ nemá funkčné overenie dostupných modelov (get_claude_models
# padá), takže ho z tejto kontroly dočasne vynechávame - v hlavnej ai_call_json_model
# reťazi zostáva Claude aktívny, toto sa týka len /health a diagnostiky.
_HEALTH_CHECK_PROVIDERS = {"openai", "gemini"}


def get_available_ai_models() -> Dict[str, Any]:
    """Zoznam modelov od každého providera + nakonfigurované modely."""
    result: Dict[str, Any] = {p: [] for p in _HEALTH_CHECK_PROVIDERS}
    result["configured"] = {p: _get_provider_models(p) for p in _HEALTH_CHECK_PROVIDERS}
    result["errors"] = []

    for p, fn in _PROVIDER_MODELS.items():
        if p not in _HEALTH_CHECK_PROVIDERS:
            continue
        try:
            result[p] = fn()
        except Exception as e:
            result["errors"].append(f"{p}: {e}")

    return result


def check_configured_models_health() -> Dict[str, Any]:
    """Porovná nakonfigurované modely s reálne dostupnými."""
    available = get_available_ai_models()
    missing: Dict[str, List[str]] = {}

    for p in _HEALTH_CHECK_PROVIDERS:
        available_models = available.get(p, [])
        missing[p] = [m for m in _get_provider_models(p) if m not in available_models]

    api_errors = available.get("errors", [])
    is_ok = not any(missing.values()) and not api_errors
    return {"ok": is_ok, "missing": missing, "api_errors": api_errors}


def get_ai_health_status() -> Tuple[bool, str]:
    """Jednoduchý health check pre externé služby — vracia (ok, error_message)."""
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
