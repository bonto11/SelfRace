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

_VALID_PROVIDERS = set(_PROVIDER_FALLBACKS.keys())


# =============================================================================
# HELPERS
# =============================================================================

def _get_api_key(provider: str) -> Optional[str]:
    """
    Číta API kľúč VŽDY live z importovanej premennej — nie z dict načítaného pri importe.
    Toto zaručí že ak sa ENV zmení (napr. Railway redeploy), provider to zachytí správne.
    """
    if provider == "openai":
        return OPENAI_API_KEY
    if provider == "gemini":
        return GEMINI_API_KEY
    if provider == "claude":
        return CLAUDE_API_KEY
    return None


def _get_primary_provider() -> str:
    """Prečíta AI_PROVIDER z ENV a validuje — fallback na gemini ak neznámy."""
    p = (AI_PROVIDER or "gemini").strip().lower()
    if p not in _VALID_PROVIDERS:
        print(f"[PROVIDER] ⚠️  Neznámy AI_PROVIDER='{p}', fallback na 'gemini'")
        return "gemini"
    return p


def _build_chain(primary: str, requested_model: Optional[str]) -> List[Tuple[str, str]]:
    """
    Zostaví poradovník (provider, model) pre jedno volanie.
    1. Primárny provider — requested_model ak zadaný, potom jeho fallbacky z ENV
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

    # 2. Záchranná sieť — ostatní provideri v poradí
    for p in _FALLBACK_ORDER:
        if p == primary:
            continue
        for m in _PROVIDER_FALLBACKS[p]:
            if m:
                chain.append((p, m.strip()))

    return chain


def _log_chain_start(primary: str, chain: List[Tuple[str, str]]) -> None:
    """Vypíše celý plánovaný chain pred spustením — vidíš čo sa bude volať."""
    chain_str = " → ".join(f"{p}:{m}" for p, m in chain)
    print(f"[PROVIDER] 🚀 primary={primary} | chain: {chain_str}")
    # Overenie kľúčov pre každého providera v chaine
    checked: set = set()
    for p, _ in chain:
        if p in checked:
            continue
        checked.add(p)
        key = _get_api_key(p)
        status = f"✅ key present ({str(key)[:12]}...)" if key else "❌ NO KEY"
        print(f"[PROVIDER]   {p}: {status}")


def _log_attempt(provider: str, model: str, attempt_num: int, ok: bool, duration_ms: int, error: Optional[str] = None) -> None:
    """Log pre každý pokus — úspech alebo zlyhanie s dôvodom."""
    icon = "✅" if ok else "❌"
    base = f"[PROVIDER] {icon} attempt#{attempt_num} {provider}:{model} ({duration_ms}ms)"
    if ok:
        print(base)
    else:
        print(f"{base} → {error}")


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
    """Zavolá konkrétneho AI providera s danými parametrami."""
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
    Pri každom pokuse loguje provider, model, výsledok a dôvod zlyhania.
    """
    import time

    primary = _get_primary_provider()
    chain = _build_chain(primary, model)
    attempts: List[Dict[str, Any]] = []

    # Zobrazí celý plán pred spustením
    _log_chain_start(primary, chain)

    attempt_num = 0

    for provider, m in chain:
        attempt_num += 1
        started = time.time()

        # Preskočíme ak chýba API kľúč — live check, nie z importu
        key = _get_api_key(provider)
        if not key:
            dur_ms = int((time.time() - started) * 1000)
            error = f"Chýba API kľúč pre '{provider}'"
            _log_attempt(provider, m, attempt_num, ok=False, duration_ms=dur_ms, error=error)
            attempts.append({"provider": provider, "model": m, "error": error})
            continue

        try:
            print(f"[PROVIDER] ⏳ calling {provider}:{m} ...")
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
                _log_attempt(provider, m, attempt_num, ok=True, duration_ms=dur_ms)
                print(f"[PROVIDER] 🎉 SUCCESS → {provider}:{m}")
                if not res.trace:
                    res.trace = {}
                res.trace["attempts"] = attempts
                res.trace["ok_provider"] = provider
                res.trace["ok_model"] = m
                res.provider = provider
                res.model = m
                return res

            err = res.error.message if (res and res.error) else "Neznáma chyba"
            _log_attempt(provider, m, attempt_num, ok=False, duration_ms=dur_ms, error=err)
            attempts.append({"provider": provider, "model": m, "error": err})

        except Exception as e:
            dur_ms = int((time.time() - started) * 1000)
            err = f"{type(e).__name__}: {e}"
            _log_attempt(provider, m, attempt_num, ok=False, duration_ms=dur_ms, error=err)
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

def get_available_ai_models() -> Dict[str, Any]:
    """Zoznam modelov od každého providera + nakonfigurované modely."""
    result: Dict[str, Any] = {p: [] for p in _VALID_PROVIDERS}
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