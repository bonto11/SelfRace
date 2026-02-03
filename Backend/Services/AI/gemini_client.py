# backend/Services/AI/gemini_client.py
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


def _timeout_s() -> int:
    """
    Gemini minimum deadline je 10s (inak 400).
    Reálne odporúčam aspoň 30s.
    """
    try:
        t = int(LLM_TIMEOUT_S or 0)
    except Exception:
        t = 0
    return max(t, 30)


def _get_client() -> genai.Client:
    """
    google-genai SDK.
    Poznámka: api_version nechávam na v1beta, lebo je zatiaľ najkompatibilnejšie
    s rôznymi modelmi/endpointmi; ak by sa to menilo, vyhoď api_version úplne.
    """
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY v Configs.config")

        _CLIENT = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options={
                "api_version": "v1beta",
                "timeout": _timeout_s(),
            },
        )
    return _CLIENT


def _clean_model_name(name: str) -> str:
    if not name:
        return ""
    s = str(name).strip()
    if s.lower().startswith("models/"):
        s = s.split("/", 1)[1]
    return s


def _uniq_keep_order(items: List[str]) -> List[str]:
    out: List[str] = []
    for x in items:
        x = (x or "").strip()
        if x and x not in out:
            out.append(x)
    return out


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    base: List[str] = []

    if GEMINI_DEFAULT_MODEL:
        base.append(_clean_model_name(GEMINI_DEFAULT_MODEL))

    # GEMINI_MODEL_FALLBACKS je u teba vždy List[str] (z _csv_list)
    if isinstance(GEMINI_MODEL_FALLBACKS, list):
        base.extend([_clean_model_name(m) for m in GEMINI_MODEL_FALLBACKS if m])

    base = _uniq_keep_order([m for m in base if m]) or ["gemini-1.5-flash"]

    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            return _uniq_keep_order([em] + base)

    return base


def _build_contents(system_prompt: str, user_txt: str) -> List[types.Content]:
    """
    Najkompatibilnejšie: poslať system prompt ako role="system" content
    (nepchať ho do config.system_instruction).
    """
    return [
        types.Content(role="system", parts=[types.Part(text=system_prompt)]),
        types.Content(role="user", parts=[types.Part(text=user_txt)]),
    ]


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
            provider="gemini",
            model=model or "unknown",
            error=AiError(code="ai_missing_key", message="GEMINI_API_KEY is not defined"),
        )

    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)

    trace: Dict[str, Any] = {
        "models_tried": models,
        "attempts": [],
        "config": {
            "retries": retries,
            "timeout_s_effective": _timeout_s(),
            "timeout_s_env": int(LLM_TIMEOUT_S or 0),
        },
    }

    last_err: Optional[str] = None
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)

    # Dôležité: JSON output vyžiadame promptom (nie response_mime_type),
    # aby to nepadalo na "unknown field" pri rôznych API verziách.
    user_txt = (
        f"{user_instructions.rstrip()}\n\n"
        f"---\n"
        f"Context JSON (ground truth):\n{ctx_json}\n\n"
        f"IMPORTANT: Respond with STRICT JSON only (no markdown, no prose)."
    )

    contents = _build_contents(system_prompt, user_txt)

    # Minimal config (bez system_instruction, bez response_mime_type, bez per-call timeout override)
    cfg = types.GenerateContentConfig(
        temperature=float(temperature),
        max_output_tokens=int(max_tokens),
    )

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=contents,
                    config=cfg,
                )

                dur_ms = int((time.time() - started) * 1000)
                raw = (getattr(resp, "text", None) or "").strip()

                if not raw:
                    last_err = "Gemini returned empty response"
                    trace["attempts"].append(
                        {"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err}
                    )
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                ok = isinstance(parsed, dict)
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": ok,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:400] + ("…[truncated]" if len(raw) > 400 else ""),
                    }
                )

                if not ok:
                    last_err = "Gemini returned invalid JSON"
                    continue

                if debug_raw:
                    trace["raw"] = last_raw
                    trace["cleaned"] = last_cleaned

                return AiResult(ok=True, data=parsed, provider="gemini", model=m)

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err}
                )

                # 404/NOT_FOUND: ďalšie retry pre tento model nemá zmysel
                if "404" in last_err or "not_found" in last_err.lower():
                    break

                time.sleep(0.4 * attempt)

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned

    return AiResult(
        ok=False,
        data=None,
        provider="gemini",
        model=(models[0] if models else (model or "unknown")),
        error=AiError(
            code="ai_gemini_failed",
            message=last_err or "Unknown",
            trace=(trace if debug_raw else None),
        ),
    )